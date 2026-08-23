// src/reporters/modules/converters.ts
// Конвертеры данных - преобразование EntitiesResult в EnhancedEntityInfo

import {
  EntitiesResult,
  EnhancedEntityInfo,
  EnhancedFunctionInfo,
  EnhancedConstantInfo,
  EnhancedVariableInfo,
  EnhancedInterfaceInfo,
  EnhancedTypeInfo,
  EnhancedClassInfo,
  FunctionEntity,
} from './types.js';

import { safeString, safeNumber, safeBoolean, ensureArray } from './utils.js';

// ============================================================
// 🔧 convertToEnhancedEntityInfo - СОХРАНЯЕТ ВСЕ ПОЛЯ
// ============================================================

/**
 * Преобразует EntitiesResult в EnhancedEntityInfo
 * ✅ СОХРАНЯЕТ: calls, calledBy, body, complexity, security, signature, vscode
 */
export function convertToEnhancedEntityInfo(entities: EntitiesResult): EnhancedEntityInfo {
  // Проверяем входные данные
  if (!entities || typeof entities !== 'object') {
    console.warn('⚠️ convertToEnhancedEntityInfo: entities is null or undefined');
    return {
      functions: [],
      constants: [],
      variables: [],
      interfaces: [],
      types: [],
      classes: [],
    };
  }

  // ✅ ЛОГИРУЕМ ВХОДНЫЕ ДАННЫЕ
  const rawFunctions = ensureArray(entities.functions);
  if (rawFunctions.length > 0) {
    // console.log(`   📥 convertToEnhancedEntityInfo: входных функций: ${rawFunctions.length}`);
    // const firstFunc = rawFunctions[0] as any;
    // console.log(`   📥 Первая функция: ${firstFunc?.name || 'unknown'}`);
  }

  // ✅ Преобразуем функции с СОХРАНЕНИЕМ ВСЕХ ПОЛЕЙ
  const functions: EnhancedFunctionInfo[] = rawFunctions.map(
    (rawFunc: any): EnhancedFunctionInfo => {
      // Если это уже FunctionEntity, возвращаем как есть
      if (rawFunc && typeof rawFunc === 'object' && rawFunc._safeInfo !== undefined) {
        return rawFunc as EnhancedFunctionInfo;
      }

      const func = rawFunc as any;
      const funcName = safeString(func.name);

      // ✅ СОХРАНЯЕМ calls как массив строк
      const calls = ensureArray(func.calls).map((c: any) => safeString(c));

      // ✅ СОХРАНЯЕМ calledBy как массив объектов
      let calledBy: { function: string; module: string; line: number }[] = [];
      const rawCalledBy = ensureArray(func.calledBy);

      if (rawCalledBy.length > 0) {
        if (typeof rawCalledBy[0] === 'string') {
          calledBy = rawCalledBy.map((cb: any) => ({
            function: safeString(cb),
            module: safeString(func._modulePath || entities.moduleName || 'unknown'),
            line: safeNumber(func.line || 0),
          }));
        } else {
          calledBy = rawCalledBy.map((cb: any) => ({
            function: safeString(cb.function || cb),
            module: safeString(cb.module || func._modulePath || entities.moduleName || 'unknown'),
            line: safeNumber(cb.line || func.line || 0),
          }));
        }
      }

      // ✅ СОХРАНЯЕМ security
      let security = {
        hasEval: false,
        hasProcessEnv: false,
        hasSensitiveData: false,
        hasExec: false,
        hasPassword: false,
      };
      if (func.security && typeof func.security === 'object') {
        const sec = func.security as any;
        security = {
          hasEval: safeBoolean(sec.hasEval),
          hasProcessEnv: safeBoolean(sec.hasProcessEnv),
          hasSensitiveData: safeBoolean(sec.hasSensitiveData),
          hasExec: safeBoolean(sec.hasExec),
          hasPassword: safeBoolean(sec.hasPassword),
        };
      }

      // ✅ СОХРАНЯЕМ body

      const body =  '';
      // const body = func.body || '';

      // ✅ СОХРАНЯЕМ signature (будет заполнена позже в packages.ts)
      const signature = func.signature || '';

      // ✅ СОХРАНЯЕМ vscode (будет заполнена позже в packages.ts)
      const vscode = func.vscode || '';

      return {
        name: funcName,
        params: ensureArray(func.params).map((p: any) => safeString(p)),
        paramTypes: ensureArray(func.paramTypes || func.params).map(() => 'any'),
        line: safeNumber(func.line),
        startLine: safeNumber(func.startLine || func.line),
        endLine: safeNumber(func.endLine || func.line),
        isAsync: safeBoolean(func.isAsync),
        isExported: safeBoolean(func.isExported),
        isMethod: safeBoolean(func.isMethod),
        className: safeString(func.className),
        // ✅ КРИТИЧЕСКИ ВАЖНО: сохраняем calls
        calls: calls,
        // ✅ КРИТИЧЕСКИ ВАЖНО: сохраняем calledBy
        calledBy: calledBy,
        returnType: safeString(func.returnType),
        // ✅ КРИТИЧЕСКИ ВАЖНО: сохраняем body
        body: body,
        // ✅ НОВОЕ: сохраняем signature
        signature: signature,
        // ✅ НОВОЕ: сохраняем vscode
        vscode: vscode,
        isNested: safeBoolean(func.isNested),
        parentFunction: safeString(func.parentFunction),
        isArrow: safeBoolean(func.isArrow),
        isEventHandler: safeBoolean(func.isEventHandler),
        eventType: safeString(func.eventType),
        depth: safeNumber(func.depth),
        // ✅ КРИТИЧЕСКИ ВАЖНО: сохраняем complexity
        complexity: safeNumber(func.complexity || 1),
        // ✅ КРИТИЧЕСКИ ВАЖНО: сохраняем security
        security: security,
        _safeInfo: null,
      };
    }
  );

  // ✅ ЛОГИРУЕМ РЕЗУЛЬТАТ
  if (functions.length > 0) {
    // console.log(`   📤 convertToEnhancedEntityInfo: выходных функций: ${functions.length}`);
    const firstFunc = functions[0];
    if (firstFunc) {
      // console.log(`   📤 Первая функция: ${firstFunc.name}, calls: ${firstFunc.calls.length}`);
    }
  }

  // ✅ Преобразуем классы
  const classes: EnhancedClassInfo[] = ensureArray(entities.classes).map((rawClass: any) => {
    const c = rawClass as any;
    return {
      name: safeString(c.name),
      methods: ensureArray(c.methods).map((m: any) => safeString(m)),
      methodDetails: ensureArray(c.methodDetails || c.methods).map((m: any) => ({
        name: safeString(m.name || m),
        params: ensureArray(m.params || []).map((p: any) => safeString(p)),
        returnType: safeString(m.returnType || 'any'),
        isAsync: safeBoolean(m.isAsync || false),
        line: safeNumber(m.line || c.line || 0),
      })),
      properties: ensureArray(c.properties).map((p: any) => safeString(p)),
      propertyDetails: ensureArray(c.propertyDetails || c.properties).map((p: any) => ({
        name: safeString(p.name || p),
        type: safeString(p.type || 'any'),
        line: safeNumber(p.line || c.line || 0),
      })),
      line: safeNumber(c.line),
      isExported: safeBoolean(c.isExported),
      extends: safeString(c.extends),
      implements: ensureArray(c.implements).map((i: any) => safeString(i)),
      startLine: safeNumber(c.startLine || c.line),
      endLine: safeNumber(c.endLine || c.line),
      // ✅ НОВОЕ: сохраняем body и vscode для классов
      // body: c.body || '',
      vscode: c.vscode || '',
      _safeInfo: null,
    };
  });

  // ✅ Преобразуем константы
  const constants: EnhancedConstantInfo[] = ensureArray(entities.constants).map((rawConst: any) => {
    const c = rawConst as any;
    return {
      name: safeString(c.name),
      value: c.value,
      line: safeNumber(c.line),
      isExported: safeBoolean(c.isExported),
      type: safeString(c.type),
      _safeInfo: null,
    };
  });

  // ✅ Преобразуем переменные
  const variables: EnhancedVariableInfo[] = ensureArray(entities.variables).map((rawVar: any) => {
    const v = rawVar as any;
    return {
      name: safeString(v.name),
      value: v.value,
      line: safeNumber(v.line),
      isExported: safeBoolean(v.isExported),
      type: safeString(v.type),
      _safeInfo: null,
    };
  });

  // ✅ Преобразуем интерфейсы
  const interfaces: EnhancedInterfaceInfo[] = ensureArray(entities.interfaces).map(
    (rawIntf: any) => {
      const i = rawIntf as any;
      return {
        name: safeString(i.name),
        properties: ensureArray(i.properties).map((p: any) => safeString(p)),
        line: safeNumber(i.line),
        isExported: safeBoolean(i.isExported),
        extends: ensureArray(i.extends).map((e: any) => safeString(e)),
        startLine: safeNumber(i.startLine || i.line),
        endLine: safeNumber(i.endLine || i.line),
        _safeInfo: null,
      };
    }
  );

  // ✅ Преобразуем типы
  const types: EnhancedTypeInfo[] = ensureArray(entities.types).map((rawType: any) => {
    const t = rawType as any;
    return {
      name: safeString(t.name),
      definition: safeString(t.definition),
      line: safeNumber(t.line),
      isExported: safeBoolean(t.isExported),
      _safeInfo: null,
    };
  });

  // ✅ ЛОГИРУЕМ ИТОГОВУЮ СТАТИСТИКУ
  // console.log(
  //   `   📊 convertToEnhancedEntityInfo: функции с calls: ${functions.filter(f => f.calls.length > 0).length}`
  // );
  // console.log(
  //   `   📊 convertToEnhancedEntityInfo: функции с calledBy: ${functions.filter(f => f.calledBy.length > 0).length}`
  // );
  // console.log(
  //   `   📊 convertToEnhancedEntityInfo: функции с body: ${functions.filter(f => f.body && f.body.length > 0).length}`
  // );

  return {
    functions: functions as EnhancedFunctionInfo[],
    constants,
    variables,
    interfaces,
    types,
    classes,
  };
}

// ============================================================
// ОБРАТНОЕ ПРЕОБРАЗОВАНИЕ
// ============================================================

/**
 * Преобразует EnhancedEntityInfo обратно в EntitiesResult
 */
export function convertFromEnhancedEntityInfo(enhanced: EnhancedEntityInfo): EntitiesResult {
  return {
    functions: enhanced.functions.map((f: FunctionEntity) => ({
      name: f.name,
      params: f.params,
      line: f.line,
      isAsync: f.isAsync,
      isExported: f.isExported,
      isMethod: f.isMethod || false,
      className: f.className || '',
      calls: f.calls || [],
      calledBy: f.calledBy || [],
      returnType: f.returnType || 'any',
      body: f.body || '',
      isNested: f.isNested || false,
      parentFunction: f.parentFunction || '',
      isArrow: f.isArrow || false,
      isEventHandler: f.isEventHandler || false,
      eventType: f.eventType || '',
      depth: f.depth || 0,
      startLine: f.startLine || f.line,
      endLine: f.endLine || f.line,
      complexity: f.complexity || 1,
      security: f.security || {
        hasEval: false,
        hasProcessEnv: false,
        hasSensitiveData: false,
        hasExec: false,
        hasPassword: false,
      },
    })),
    classes: enhanced.classes.map(c => ({
      name: c.name,
      methods: c.methods,
      properties: c.properties,
      line: c.line,
      isExported: c.isExported,
      extends: c.extends || '',
      implements: c.implements || [],
      startLine: c.startLine || c.line,
      endLine: c.endLine || c.line,
    })),
    constants: enhanced.constants.map(c => ({
      name: c.name,
      value: c.value,
      line: c.line,
      isExported: c.isExported,
      type: c.type || '',
    })),
    interfaces: enhanced.interfaces.map(i => ({
      name: i.name,
      properties: i.properties,
      line: i.line,
      isExported: i.isExported,
      extends: i.extends || [],
      startLine: i.startLine || i.line,
      endLine: i.endLine || i.line,
    })),
    types: enhanced.types.map(t => ({
      name: t.name,
      definition: t.definition,
      line: t.line,
      isExported: t.isExported,
    })),
    variables: enhanced.variables.map(v => ({
      name: v.name,
      value: v.value,
      line: v.line,
      isExported: v.isExported,
      type: v.type || '',
    })),
    imports: [],
    exports: [],
    callGraph: {},
    moduleName: '',
    filePath: '',
  };
}

/**
 * Обогащает функции данными calledBy из внешнего источника
 */
export function enrichFunctionsWithCalledBy(
  functions: FunctionEntity[],
  allFunctions: FunctionEntity[]
): FunctionEntity[] {
  // Создаем карту всех функций по имени
  const functionMap = new Map<string, FunctionEntity>();
  for (const func of allFunctions) {
    functionMap.set(func.name, func);
  }

  // Для каждой функции находим, кто ее вызывает
  return functions.map(func => {
    const calledBy: { function: string; module: string; line: number }[] = [];

    for (const caller of allFunctions) {
      if (caller.name === func.name) continue;
      if (caller.calls.includes(func.name)) {
        calledBy.push({
          function: caller.name,
          module: caller.className ? `${caller.className}` : 'unknown',
          line: caller.line,
        });
      }
    }

    return {
      ...func,
      calledBy: calledBy,
    };
  });
}

/**
 * Строит карту consumers для экспортов
 */
export function buildConsumersMap(
  functions: FunctionEntity[],
  allFunctions: FunctionEntity[]
): Map<string, { function: string; module: string; line: number }[]> {
  const consumersMap = new Map<string, { function: string; module: string; line: number }[]>();

  // Инициализируем карту для всех функций
  for (const func of functions) {
    if (func.isExported) {
      consumersMap.set(func.name, []);
    }
  }

  // Для каждой функции ищем, кто ее вызывает
  for (const caller of allFunctions) {
    for (const call of caller.calls) {
      if (consumersMap.has(call)) {
        const consumers = consumersMap.get(call)!;
        // Проверяем, нет ли уже такого потребителя
        if (!consumers.some(c => c.function === caller.name && c.module === caller.className)) {
          consumers.push({
            function: caller.name,
            module: caller.className || 'unknown',
            line: caller.line,
          });
        }
      }
    }
  }

  return consumersMap;
}

/**
 * Проверяет, является ли объект реальным (не строковым представлением)
 */
export function isRealObject(item: any): boolean {
  if (!item) return false;
  if (typeof item !== 'object') return false;
  if (Array.isArray(item)) return false;
  if (item.name === undefined) return false;
  if (item.toString && item.toString() === '[object Object]') return false;
  return true;
}

/**
 * Фильтрует массив, оставляя только реальные объекты
 */
export function filterRealObjects(arr: any[]): any[] {
  if (!Array.isArray(arr)) return [];
  return arr.filter((item: any) => isRealObject(item));
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default {
  convertToEnhancedEntityInfo,
  convertFromEnhancedEntityInfo,
  enrichFunctionsWithCalledBy,
  buildConsumersMap,
  isRealObject,
  filterRealObjects,
};
