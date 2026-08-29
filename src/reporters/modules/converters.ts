// src/reporters/modules/converters.ts

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
} from '../../types.js';

/**
 * Конвертирует EntitiesResult в EnhancedEntityInfo
 */
export function convertToEnhancedEntityInfo(
  entities: EntitiesResult,
  filePath: string
): EnhancedEntityInfo {
  return {
    functions: convertFunctions(entities.functions || [], filePath),
    constants: convertConstants(entities.constants || []),
    variables: convertVariables(entities.variables || []),
    interfaces: convertInterfaces(entities.interfaces || []),
    types: convertTypes(entities.types || []),
    classes: convertClasses(entities.classes || []),
  };
}

/**
 * Конвертирует функции в EnhancedFunctionInfo[]
 */
function convertFunctions(functions: FunctionInfo[], filePath: string): EnhancedFunctionInfo[] {
  if (!functions || functions.length === 0) {
    return [];
  }

  return functions.map(func => {
    // Преобразуем calledBy в string[]
    const calledBy: string[] = Array.isArray(func.calledBy)
      ? func.calledBy.map((cb: any) => {
          if (typeof cb === 'string') return cb;
          if (cb && typeof cb === 'object') {
            if ('function' in cb) return cb.function || String(cb);
            if ('name' in cb) return cb.name || String(cb);
          }
          return String(cb);
        })
      : [];

    // Преобразуем calls в string[]
    const calls: string[] = Array.isArray(func.calls)
      ? func.calls.map((c: any) => (typeof c === 'string' ? c : c.name || String(c)))
      : [];

    // Безопасно получаем params
    const params: string[] = Array.isArray(func.params) ? func.params : [];

    // Безопасно получаем paramTypes
    const paramTypes: string[] = Array.isArray((func as any).paramTypes)
      ? (func as any).paramTypes
      : params.map(() => 'any');

    // Получаем security
    const security = func.security || {
      hasEval: false,
      hasProcessEnv: false,
      hasSensitiveData: false,
      hasExec: false,
      hasPassword: false,
    };

    return {
      name: func.name || 'anonymous',
      params: params,
      paramTypes: paramTypes,
      line: func.line || 0,
      startLine: func.startLine || func.line || 0,
      endLine: func.endLine || func.line || 0,
      isAsync: func.isAsync || false,
      isExported: func.isExported || false,
      isMethod: func.isMethod || false,
      className: func.className || '',
      calls: calls,
      calledBy: calledBy,
      returnType: func.returnType || 'any',
      body: func.body || '',
      isNested: func.isNested || false,
      parentFunction: func.parentFunction || '',
      isArrow: func.isArrow || false,
      isEventHandler: func.isEventHandler || false,
      eventType: func.eventType || '',
      depth: func.depth || 0,
      complexity: func.complexity || 1,
      security: security,
      vscode: func.vscode || `vscode://file/${filePath}:${func.line}`,
      signature: (func as any).signature || '',
      _safeInfo: null,
    };
  });
}

/**
 * Конвертирует константы в EnhancedConstantInfo[]
 */
function convertConstants(constants: any[]): EnhancedConstantInfo[] {
  if (!constants || constants.length === 0) {
    return [];
  }

  return constants.map(c => ({
    name: c.name || 'unknown',
    line: c.line || 0,
    isExported: c.isExported || false,
    type: c.type || 'any',
    value: c.value,
    _safeInfo: null,
  }));
}

/**
 * Конвертирует переменные в EnhancedVariableInfo[]
 */
function convertVariables(variables: any[]): EnhancedVariableInfo[] {
  if (!variables || variables.length === 0) {
    return [];
  }

  return variables.map(v => ({
    name: v.name || 'unknown',
    line: v.line || 0,
    isExported: v.isExported || false,
    type: v.type || 'any',
    value: v.value,
    _safeInfo: null,
  }));
}

/**
 * Конвертирует интерфейсы в EnhancedInterfaceInfo[]
 */
function convertInterfaces(interfaces: any[]): EnhancedInterfaceInfo[] {
  if (!interfaces || interfaces.length === 0) {
    return [];
  }

  return interfaces.map(i => ({
    name: i.name || 'unknown',
    properties: Array.isArray(i.properties) ? i.properties : [],
    line: i.line || 0,
    startLine: i.startLine || i.line || 0,
    endLine: i.endLine || i.line || 0,
    isExported: i.isExported || false,
    extends: Array.isArray(i.extends) ? i.extends : [],
    _safeInfo: null,
  }));
}

/**
 * Конвертирует типы в EnhancedTypeInfo[]
 */
function convertTypes(types: any[]): EnhancedTypeInfo[] {
  if (!types || types.length === 0) {
    return [];
  }

  return types.map(t => ({
    name: t.name || 'unknown',
    definition: t.definition || 'unknown',
    line: t.line || 0,
    isExported: t.isExported || false,
    _safeInfo: null,
  }));
}

/**
 * Конвертирует классы в EnhancedClassInfo[]
 */
function convertClasses(classes: any[]): EnhancedClassInfo[] {
  if (!classes || classes.length === 0) {
    return [];
  }

  return classes.map(c => ({
    name: c.name || 'unknown',
    methods: Array.isArray(c.methods) ? c.methods : [],
    properties: Array.isArray(c.properties) ? c.properties : [],
    line: c.line || 0,
    startLine: c.startLine || c.line || 0,
    endLine: c.endLine || c.line || 0,
    isExported: c.isExported || false,
    extends: c.extends || '',
    implements: Array.isArray(c.implements) ? c.implements : [],
    _safeInfo: null,
  }));
}

/**
 * Конвертирует сущности с добавлением VSCode ссылок
 */
export function convertEntitiesWithVSCode(
  entities: EntitiesResult,
  filePath: string
): EnhancedEntityInfo {
  const result = convertToEnhancedEntityInfo(entities, filePath);

  // Добавляем VSCode ссылки для функций
  result.functions = result.functions.map(func => ({
    ...func,
    vscode: func.vscode || `vscode://file/${filePath}:${func.line}`,
  }));

  return result;
}

/**
 * Создает пустую структуру EnhancedEntityInfo
 */
export function createEmptyEnhancedEntityInfo(): EnhancedEntityInfo {
  return {
    functions: [],
    constants: [],
    variables: [],
    interfaces: [],
    types: [],
    classes: [],
  };
}

/**
 * Объединяет несколько EnhancedEntityInfo в одну
 */
export function mergeEnhancedEntityInfos(infos: EnhancedEntityInfo[]): EnhancedEntityInfo {
  const result = createEmptyEnhancedEntityInfo();

  for (const info of infos) {
    result.functions.push(...info.functions);
    result.constants.push(...info.constants);
    result.variables.push(...info.variables);
    result.interfaces.push(...info.interfaces);
    result.types.push(...info.types);
    result.classes.push(...info.classes);
  }

  return result;
}

/**
 * Проверяет, является ли сущность экспортируемой
 */
export function isExportedEntity(entity: any): boolean {
  return entity?.isExported === true;
}

/**
 * Получает все экспортируемые функции из EnhancedEntityInfo
 */
export function getExportedFunctions(info: EnhancedEntityInfo): EnhancedFunctionInfo[] {
  return info.functions.filter(f => f.isExported);
}

/**
 * Получает все импортируемые функции (не экспортируемые)
 */
export function getInternalFunctions(info: EnhancedEntityInfo): EnhancedFunctionInfo[] {
  return info.functions.filter(f => !f.isExported);
}

/**
 * Группирует функции по типу (async/exported/method)
 */
export function groupFunctionsByType(functions: EnhancedFunctionInfo[]): {
  async: EnhancedFunctionInfo[];
  exported: EnhancedFunctionInfo[];
  methods: EnhancedFunctionInfo[];
  internal: EnhancedFunctionInfo[];
} {
  return {
    async: functions.filter(f => f.isAsync),
    exported: functions.filter(f => f.isExported),
    methods: functions.filter(f => f.isMethod),
    internal: functions.filter(f => !f.isExported && !f.isMethod),
  };
}

/**
 * Подсчитывает статистику по сущностям
 */
export function countEntities(info: EnhancedEntityInfo): {
  functions: number;
  constants: number;
  variables: number;
  interfaces: number;
  types: number;
  classes: number;
  exported: number;
  total: number;
} {
  const exported =
    info.functions.filter(f => f.isExported).length +
    info.constants.filter(c => c.isExported).length +
    info.variables.filter(v => v.isExported).length +
    info.interfaces.filter(i => i.isExported).length +
    info.types.filter(t => t.isExported).length +
    info.classes.filter(c => c.isExported).length;

  return {
    functions: info.functions.length,
    constants: info.constants.length,
    variables: info.variables.length,
    interfaces: info.interfaces.length,
    types: info.types.length,
    classes: info.classes.length,
    exported,
    total:
      info.functions.length +
      info.constants.length +
      info.variables.length +
      info.interfaces.length +
      info.types.length +
      info.classes.length,
  };
}

// Экспорт по умолчанию
export default {
  convertToEnhancedEntityInfo,
  convertEntitiesWithVSCode,
  createEmptyEnhancedEntityInfo,
  mergeEnhancedEntityInfos,
  isExportedEntity,
  getExportedFunctions,
  getInternalFunctions,
  groupFunctionsByType,
  countEntities,
};
