// src/reporters/modules/converters.ts

import type {
  EnhancedEntityInfo,
  EnhancedClassInfo,
  EnhancedFunctionInfo,
  EnhancedConstantInfo,
  EnhancedVariableInfo,
  EnhancedInterfaceInfo,
  EnhancedTypeInfo,
  EntitiesResult,
  FunctionInfo,
  ClassInfo,
  ConstantInfo,
  InterfaceInfo,
  TypeInfo,
  VariableInfo,
  ImportInfo,
} from '../../types.js';

// ============================================================
// КОНВЕРТАЦИЯ ИЗ EntitiesResult В EnhancedEntityInfo
// ============================================================

/**
 * Создает пустой объект безопасности по умолчанию
 */
export function createDefaultSecurity(): EnhancedFunctionInfo['security'] {
  return {
    hasEval: false,
    hasProcessEnv: false,
    hasSensitiveData: false,
    hasExec: false,
    hasPassword: false,
  };
}

/**
 * Конвертирует EntitiesResult в EnhancedEntityInfo
 */
export function convertEntitiesToEnhanced(entities: EntitiesResult): EnhancedEntityInfo {
  const enhanced: EnhancedEntityInfo = {
    functions: [],
    constants: [],
    variables: [],
    interfaces: [],
    types: [],
    classes: [],
    imports: [],
  };

  // Конвертируем функции
  for (const func of entities.functions || []) {
    enhanced.functions.push(convertFunctionToEnhanced(func));
  }

  // Конвертируем константы
  for (const constItem of entities.constants || []) {
    enhanced.constants.push(convertConstantToEnhanced(constItem));
  }

  // Конвертируем переменные
  for (const varItem of entities.variables || []) {
    enhanced.variables.push(convertVariableToEnhanced(varItem));
  }

  // Конвертируем интерфейсы
  for (const intf of entities.interfaces || []) {
    enhanced.interfaces.push(convertInterfaceToEnhanced(intf));
  }

  // Конвертируем типы
  for (const type of entities.types || []) {
    enhanced.types.push(convertTypeToEnhanced(type));
  }

  // Конвертируем классы
  for (const cls of entities.classes || []) {
    enhanced.classes.push(convertClassToEnhanced(cls));
  }

  // Конвертируем импорты
  if (entities.imports) {
    enhanced.imports = entities.imports.map((imp: ImportInfo) => ({
      source: imp.source,
      specifiers: imp.specifiers.map(s =>
        typeof s === 'string' ? s : s.imported || s.local || ''
      ),
      isTypeOnly: imp.isTypeOnly || false,
    }));
  }

  return enhanced;
}

/**
 * Конвертирует FunctionInfo в EnhancedFunctionInfo
 */
export function convertFunctionToEnhanced(func: FunctionInfo): EnhancedFunctionInfo {
  return {
    name: func.name || 'anonymous',
    params: func.params || [],
    paramTypes: func.params?.map(() => 'any') || [],
    line: func.line || 0,
    startLine: func.startLine || func.line || 0,
    endLine: func.endLine || func.line || 0,
    isAsync: func.isAsync || false,
    isExported: func.isExported || false,
    isMethod: func.isMethod || false,
    className: func.className || '',
    calls: func.calls || [],
    calledBy: func.calledBy || [],
    returnType: func.returnType || 'any',
    body: func.body || '',
    isNested: func.isNested || false,
    parentFunction: func.parentFunction || '',
    isArrow: func.isArrow || false,
    isEventHandler: func.isEventHandler || false,
    eventType: func.eventType || '',
    depth: func.depth || 0,
    complexity: func.complexity || 1,
    security: func.security || createDefaultSecurity(),
    vscode: func.vscode || '',
    signature: func.signature || '',
    _safeInfo: null,
  };
}

/**
 * Конвертирует ConstantInfo в EnhancedConstantInfo
 */
export function convertConstantToEnhanced(constItem: ConstantInfo): EnhancedConstantInfo {
  return {
    name: constItem.name || 'unknown',
    line: constItem.line || 0,
    isExported: constItem.isExported || false,
    type: constItem.type || 'any',
    value: constItem.value,
    _safeInfo: null,
  };
}

/**
 * Конвертирует VariableInfo в EnhancedVariableInfo
 */
export function convertVariableToEnhanced(varItem: VariableInfo): EnhancedVariableInfo {
  return {
    name: varItem.name || 'unknown',
    line: varItem.line || 0,
    isExported: varItem.isExported || false,
    type: varItem.type || 'any',
    value: varItem.value,
    _safeInfo: null,
  };
}

/**
 * Конвертирует InterfaceInfo в EnhancedInterfaceInfo
 */
export function convertInterfaceToEnhanced(intf: InterfaceInfo): EnhancedInterfaceInfo {
  return {
    name: intf.name || 'unknown',
    properties: intf.properties || [],
    line: intf.line || 0,
    startLine: intf.startLine || intf.line || 0,
    endLine: intf.endLine || intf.line || 0,
    isExported: intf.isExported || false,
    extends: intf.extends || [],
    _safeInfo: null,
  };
}

/**
 * Конвертирует TypeInfo в EnhancedTypeInfo
 */
export function convertTypeToEnhanced(type: TypeInfo): EnhancedTypeInfo {
  return {
    name: type.name || 'unknown',
    definition: type.definition || 'unknown',
    line: type.line || 0,
    isExported: type.isExported || false,
    _safeInfo: null,
  };
}

/**
 * Конвертирует ClassInfo в EnhancedClassInfo
 */
export function convertClassToEnhanced(cls: ClassInfo): EnhancedClassInfo {
  return {
    name: cls.name || 'unknown',
    methods: cls.methods || [],
    properties: cls.properties || [],
    line: cls.line || 0,
    startLine: cls.startLine || cls.line || 0,
    endLine: cls.endLine || cls.line || 0,
    isExported: cls.isExported || false,
    extends: cls.extends,
    implements: cls.implements || [],
    _safeInfo: null,
  };
}

// ============================================================
// КОНВЕРТАЦИЯ ИЗ ENHANCED В ENTITIES
// ============================================================

/**
 * Конвертирует EnhancedEntityInfo обратно в EntitiesResult
 */
export function convertEnhancedToEntities(enhanced: EnhancedEntityInfo): EntitiesResult {
  const entities: EntitiesResult = {
    functions: [],
    classes: [],
    constants: [],
    interfaces: [],
    types: [],
    variables: [],
    imports: [],
    exports: [],
    callGraph: {},
    moduleName: '',
    filePath: '',
  };

  // Конвертируем функции
  for (const func of enhanced.functions || []) {
    entities.functions.push(convertEnhancedFunctionToFunction(func));
  }

  // Конвертируем классы
  for (const cls of enhanced.classes || []) {
    entities.classes.push(convertEnhancedClassToClass(cls));
  }

  // Конвертируем константы
  for (const constItem of enhanced.constants || []) {
    entities.constants.push(convertEnhancedConstantToConstant(constItem));
  }

  // Конвертируем интерфейсы
  for (const intf of enhanced.interfaces || []) {
    entities.interfaces.push(convertEnhancedInterfaceToInterface(intf));
  }

  // Конвертируем типы
  for (const type of enhanced.types || []) {
    entities.types.push(convertEnhancedTypeToType(type));
  }

  // Конвертируем переменные
  for (const varItem of enhanced.variables || []) {
    entities.variables.push(convertEnhancedVariableToVariable(varItem));
  }

  // Конвертируем импорты
  if (enhanced.imports) {
    entities.imports = enhanced.imports.map(imp => ({
      source: imp.source,
      specifiers: imp.specifiers.map(s => ({
        local: s,
        imported: s,
        type: 'ImportSpecifier',
      })),
      loc: null,
      isTypeOnly: imp.isTypeOnly || false,
    }));
  }

  return entities;
}

/**
 * Конвертирует EnhancedFunctionInfo в FunctionInfo
 */
export function convertEnhancedFunctionToFunction(enhanced: EnhancedFunctionInfo): FunctionInfo {
  return {
    name: enhanced.name,
    line: enhanced.line,
    isAsync: enhanced.isAsync,
    isExported: enhanced.isExported,
    params: enhanced.params,
    returnType: enhanced.returnType,
    calls: enhanced.calls || [],
    calledBy: enhanced.calledBy || [],
    body: enhanced.body || '',
    startLine: enhanced.startLine,
    endLine: enhanced.endLine,
    isMethod: enhanced.isMethod,
    className: enhanced.className,
    isNested: enhanced.isNested,
    parentFunction: enhanced.parentFunction,
    isArrow: enhanced.isArrow,
    isEventHandler: enhanced.isEventHandler,
    eventType: enhanced.eventType,
    depth: enhanced.depth,
    complexity: enhanced.complexity,
    security: enhanced.security,
    vscode: enhanced.vscode,
    signature: enhanced.signature,
  };
}

/**
 * Конвертирует EnhancedClassInfo в ClassInfo
 */
export function convertEnhancedClassToClass(enhanced: EnhancedClassInfo): ClassInfo {
  return {
    name: enhanced.name,
    line: enhanced.line,
    isExported: enhanced.isExported,
    methods: enhanced.methods || [],
    properties: enhanced.properties || [],
    extends: enhanced.extends,
    implements: enhanced.implements || [],
    startLine: enhanced.startLine,
    endLine: enhanced.endLine,
  };
}

/**
 * Конвертирует EnhancedConstantInfo в ConstantInfo
 */
export function convertEnhancedConstantToConstant(enhanced: EnhancedConstantInfo): ConstantInfo {
  return {
    name: enhanced.name,
    line: enhanced.line,
    value: enhanced.value,
    isExported: enhanced.isExported,
    type: enhanced.type,
  };
}

/**
 * Конвертирует EnhancedInterfaceInfo в InterfaceInfo
 */
export function convertEnhancedInterfaceToInterface(
  enhanced: EnhancedInterfaceInfo
): InterfaceInfo {
  return {
    name: enhanced.name,
    line: enhanced.line,
    isExported: enhanced.isExported,
    properties: enhanced.properties || [],
    extends: enhanced.extends || [],
    startLine: enhanced.startLine,
    endLine: enhanced.endLine,
  };
}

/**
 * Конвертирует EnhancedTypeInfo в TypeInfo
 */
export function convertEnhancedTypeToType(enhanced: EnhancedTypeInfo): TypeInfo {
  return {
    name: enhanced.name,
    line: enhanced.line,
    isExported: enhanced.isExported,
    definition: enhanced.definition || 'unknown',
  };
}

/**
 * Конвертирует EnhancedVariableInfo в VariableInfo
 */
export function convertEnhancedVariableToVariable(enhanced: EnhancedVariableInfo): VariableInfo {
  return {
    name: enhanced.name,
    line: enhanced.line,
    isExported: enhanced.isExported,
    type: enhanced.type || 'any',
    value: enhanced.value,
  };
}

// ============================================================
// УТИЛИТЫ ДЛЯ РАБОТЫ С ENHANCED ENTITY INFO
// ============================================================

/**
 * Получает все экспортируемые функции из EnhancedEntityInfo
 */
export function getExportedFunctions(info: EnhancedEntityInfo): EnhancedFunctionInfo[] {
  return info.functions.filter((f: EnhancedFunctionInfo) => f.isExported);
}

/**
 * Получает все неэкспортируемые функции из EnhancedEntityInfo
 */
export function getUnexportedFunctions(info: EnhancedEntityInfo): EnhancedFunctionInfo[] {
  return info.functions.filter((f: EnhancedFunctionInfo) => !f.isExported);
}

/**
 * Получает все асинхронные функции из EnhancedEntityInfo
 */
export function getAsyncFunctions(info: EnhancedEntityInfo): EnhancedFunctionInfo[] {
  return info.functions.filter((f: EnhancedFunctionInfo) => f.isAsync);
}

/**
 * Получает все синхронные функции из EnhancedEntityInfo
 */
export function getSyncFunctions(info: EnhancedEntityInfo): EnhancedFunctionInfo[] {
  return info.functions.filter((f: EnhancedFunctionInfo) => !f.isAsync);
}

/**
 * Получает все методы из EnhancedEntityInfo
 */
export function getMethods(info: EnhancedEntityInfo): EnhancedFunctionInfo[] {
  return info.functions.filter((f: EnhancedFunctionInfo) => f.isMethod);
}

/**
 * Получает все функции, не являющиеся методами
 */
export function getStandaloneFunctions(info: EnhancedEntityInfo): EnhancedFunctionInfo[] {
  return info.functions.filter((f: EnhancedFunctionInfo) => !f.isMethod);
}

/**
 * Подсчитывает общее количество экспортируемых сущностей
 */
export function countExportedEntities(info: EnhancedEntityInfo): number {
  const funcs = info.functions.filter((f: EnhancedFunctionInfo) => f.isExported).length;
  const constants = info.constants.filter((c: EnhancedConstantInfo) => c.isExported).length;
  const variables = info.variables.filter((v: EnhancedVariableInfo) => v.isExported).length;
  const interfaces = info.interfaces.filter((i: EnhancedInterfaceInfo) => i.isExported).length;
  const types = info.types.filter((t: EnhancedTypeInfo) => t.isExported).length;
  const classes = info.classes.filter((c: EnhancedClassInfo) => c.isExported).length;

  return funcs + constants + variables + interfaces + types + classes;
}

/**
 * Подсчитывает общее количество сущностей
 */
export function countEntities(info: EnhancedEntityInfo): number {
  return (
    info.functions.length +
    info.constants.length +
    info.variables.length +
    info.interfaces.length +
    info.types.length +
    info.classes.length
  );
}

/**
 * Получает все функции с телом (не пустым)
 */
export function getFunctionsWithBody(info: EnhancedEntityInfo): EnhancedFunctionInfo[] {
  return info.functions.filter((f: EnhancedFunctionInfo) => f.body && f.body.trim().length > 0);
}

/**
 * Получает все функции без тела (пустые)
 */
export function getFunctionsWithoutBody(info: EnhancedEntityInfo): EnhancedFunctionInfo[] {
  return info.functions.filter((f: EnhancedFunctionInfo) => !f.body || f.body.trim().length === 0);
}

/**
 * Получает все функции с вызовами
 */
export function getFunctionsWithCalls(info: EnhancedEntityInfo): EnhancedFunctionInfo[] {
  return info.functions.filter((f: EnhancedFunctionInfo) => f.calls && f.calls.length > 0);
}

/**
 * Получает все функции без вызовов
 */
export function getFunctionsWithoutCalls(info: EnhancedEntityInfo): EnhancedFunctionInfo[] {
  return info.functions.filter((f: EnhancedFunctionInfo) => !f.calls || f.calls.length === 0);
}

/**
 * Получает все функции с безопасностью (не пустой security)
 */
export function getFunctionsWithSecurity(info: EnhancedEntityInfo): EnhancedFunctionInfo[] {
  return info.functions.filter((f: EnhancedFunctionInfo) => {
    const sec = f.security;
    return (
      sec &&
      (sec.hasEval || sec.hasProcessEnv || sec.hasSensitiveData || sec.hasExec || sec.hasPassword)
    );
  });
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default {
  convertEntitiesToEnhanced,
  convertFunctionToEnhanced,
  convertConstantToEnhanced,
  convertVariableToEnhanced,
  convertInterfaceToEnhanced,
  convertTypeToEnhanced,
  convertClassToEnhanced,
  convertEnhancedToEntities,
  convertEnhancedFunctionToFunction,
  convertEnhancedClassToClass,
  convertEnhancedConstantToConstant,
  convertEnhancedInterfaceToInterface,
  convertEnhancedTypeToType,
  convertEnhancedVariableToVariable,
  getExportedFunctions,
  getUnexportedFunctions,
  getAsyncFunctions,
  getSyncFunctions,
  getMethods,
  getStandaloneFunctions,
  countExportedEntities,
  countEntities,
  getFunctionsWithBody,
  getFunctionsWithoutBody,
  getFunctionsWithCalls,
  getFunctionsWithoutCalls,
  getFunctionsWithSecurity,
  createDefaultSecurity,
};
