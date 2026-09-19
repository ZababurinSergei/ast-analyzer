// packages/ast-analyzer/src/reporters/json/utils/entities-converter.ts

import type {
  EntitiesResult,
  EnhancedEntityInfo,
  FunctionInfo,
  ClassInfo,
  ConstantInfo,
  InterfaceInfo,
  TypeInfo,
  VariableInfo,
  ImportInfo,
  ExportInfo,
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
 */
export function createEmptyEntitiesResult(
  filePath: string = ''
): EntitiesResult {
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
// КОНВЕРТЕР: EntitiesResult → EnhancedEntityInfo
// ============================================================

/**
 * Конвертирует EntitiesResult в EnhancedEntityInfo.
 *
 * Используется в:
 *   - buildEnhancedPackageLockReport
 *   - buildPackages (через enhancedEntitiesMap)
 *   - extractEntitiesFromFile
 *
 * Особенности:
 *   - Все поля EnhancedEntityInfo строго типизированы
 *   - Для каждой функции добавляется default security
 *   - Гарантируется, что все массивы — реальные массивы
 *   - ✅ НОВОЕ: сохраняются реэкспорты (export * from) через поле exports
 */
export function convertEntitiesToEnhanced(
  entities: EntitiesResult
): EnhancedEntityInfo {
  return {
    functions: convertFunctions(entities.functions || []),
    constants: convertConstants(entities.constants || []),
    variables: convertVariables(entities.variables || []),
    interfaces: convertInterfaces(entities.interfaces || []),
    types: convertTypes(entities.types || []),
    classes: convertClasses(entities.classes || []),
    imports: convertImports(entities.imports || []),
    // ✅ НОВОЕ: сохраняем реэкспорты (export * from)
    exports: entities.exports || [],
  };
}

// ============================================================
// КОНВЕРТЕРЫ ДЛЯ КАЖДОГО ТИПА СУЩНОСТИ
// ============================================================

/**
 * Конвертирует FunctionInfo[] → EnhancedFunctionInfo[].
 */
function convertFunctions(functions: FunctionInfo[]): EnhancedEntityInfo['functions'] {
  return functions.map((func) => ({
    // Идентификация
    name: func.name || 'anonymous',
    id: func.id,

    // Параметры
    params: ensureArray(func.params),
    paramTypes: ensureArray((func as any).paramTypes).length > 0
      ? (func as any).paramTypes
      : ensureArray(func.params).map(() => 'any'),

    // Позиция
    line: func.line || 0,
    startLine: func.startLine || func.line || 0,
    endLine: func.endLine || func.line || 0,

    // Флаги
    isAsync: func.isAsync || false,
    isExported: func.isExported || false,
    isMethod: func.isMethod || false,
    isNested: func.isNested || false,
    isArrow: func.isArrow || false,
    isEventHandler: func.isEventHandler || false,

    // Классы и вложенность
    className: func.className || '',
    parentFunction: func.parentFunction || '',

    // События
    eventType: func.eventType || '',

    // Вызовы
    calls: ensureArray(func.calls),
    calledBy: ensureArray(func.calledBy),

    // Типы
    returnType: func.returnType || 'any',

    // Тело
    body: func.body || '',

    // Глубина и сложность
    depth: func.depth || 0,
    complexity: func.complexity || 1,

    // Безопасность
    security: func.security || createDefaultSecurity(),

    // Ссылки
    vscode: func.vscode || '',

    // Сигнатура
    signature: (func as any).signature || '',

    // Встроенные связи
    callsInfo: ensureArray((func as any).callsInfo),
    calledByInfo: ensureArray((func as any).calledByInfo),
    importedBy: ensureArray((func as any).importedBy),

    // Служебное
    _safeInfo: null,
  }));
}

/**
 * Конвертирует ConstantInfo[] → EnhancedConstantInfo[].
 */
function convertConstants(constants: ConstantInfo[]): EnhancedEntityInfo['constants'] {
  return constants.map((c) => ({
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
  return variables.map((v) => ({
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
  return interfaces.map((i) => ({
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
  return types.map((t) => ({
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
  return classes.map((c) => ({
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

/**
 * Конвертирует ImportInfo[] → PackageLockImportInfo[].
 */
function convertImports(imports: ImportInfo[]): EnhancedEntityInfo['imports'] {
  return imports.map((imp) => ({
    source: imp.source,
    specifiers: ensureArray(imp.specifiers).map((s: any) =>
      typeof s === 'string' ? s : s.imported || s.local || ''
    ),
    isTypeOnly: imp.isTypeOnly || false,
  }));
}

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

/**
 * Гарантирует, что значение — массив.
 *
 * Если пришла строка вида "[object Object]", пытается распарсить её как JSON.
 * Если это не удалось — возвращает пустой массив.
 */
function ensureArray<T>(value: any): T[] {
  if (Array.isArray(value)) return value;

  if (typeof value === 'string') {
    // Строка вида "[]" — частый случай при несериализуемых данных
    const trimmed = value.trim();
    if (trimmed === '[]') return [];
    if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined') return [];

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
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default {
  createEmptyEntitiesResult,
  convertEntitiesToEnhanced,
};