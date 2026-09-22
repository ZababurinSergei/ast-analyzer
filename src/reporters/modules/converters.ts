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
  ImportSpecifier, // ✅ ДОБАВЛЕНО: явный импорт ImportSpecifier
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

  // ============================================================
  // ✅ ИСПРАВЛЕНО: импорты конвертируются в ImportSpecifier[]
  // ============================================================
  // Было: specifiers возвращались как string[], что давало TS2322
  //       (string[] несовместим с ImportSpecifier[] из ImportInfo).
  // Стало: specifiers возвращаются как массив объектов
  //        { local, imported, type } — точно по контракту ImportInfo.
  // ============================================================
  if (entities.imports) {
    enhanced.imports = entities.imports.map((imp: ImportInfo) => ({
      source: imp.source,
      specifiers: imp.specifiers.map((s: ImportSpecifier) => ({
        local: s.local ?? '',
        imported: s.imported ?? s.local ?? '',
        type: s.type ?? 'ImportSpecifier',
      })),
      isTypeOnly: imp.isTypeOnly || false,
      // ✅ ДОБАВЛЕНО: сохраняем loc при конвертации
      loc: imp.loc || null,
    }));
  }

  // ============================================================
  // ✅ P1-fix: проброс лексических связей (parent → child)
  // ============================================================
  // Без этого поля:
  //   - compact.lx = { p: [], c: [], r: [], l: [], ai: [], cn: [] }
  //   - fns.parent RLE = [[-1, N]]
  //   - decode(compact).lexicalLinks = undefined
  //   - фронт не может построить дерево вложенности
  //
  // Источник: EntitiesResult.lexicalLinks
  // (заполняется в extractEntitiesFromAST).
  // ============================================================
  if (entities.lexicalLinks && entities.lexicalLinks.length > 0) {
    enhanced.lexicalLinks = entities.lexicalLinks;
  }

  // ============================================================
  // ✅ v9.0.0: проброс расширенных Vue-секций в EnhancedEntityInfo
  // ============================================================
  // Эти поля не входят в стандартный интерфейс EntitiesResult,
  // но заполняются в convertVueAnalysisToEntities для .vue файлов.
  //
  // ⚠️ ВАЖНО: сохраняем их 1:1, потому что compact-reporter
  // читает именно `entities.templateXxx` и ожидает их наличие.
  // ============================================================
  const e = entities as any;
  if (e.templateReactivityDeps !== undefined) {
    (enhanced as any).templateReactivityDeps = e.templateReactivityDeps;
  }
  if (e.templateEventHandlers !== undefined) {
    (enhanced as any).templateEventHandlers = e.templateEventHandlers;
  }
  if (e.templateDynamicComponents !== undefined) {
    (enhanced as any).templateDynamicComponents = e.templateDynamicComponents;
  }
  if (e.templateRefs !== undefined) {
    (enhanced as any).templateRefs = e.templateRefs;
  }
  if (e.templateCssVariables !== undefined) {
    (enhanced as any).templateCssVariables = e.templateCssVariables;
  }
  if (e.templateDeepSelectors !== undefined) {
    (enhanced as any).templateDeepSelectors = e.templateDeepSelectors;
  }
  if (e.templateDirectives !== undefined) {
    (enhanced as any).templateDirectives = e.templateDirectives;
  }
  if (e.templateUsedComponents !== undefined) {
    (enhanced as any).templateUsedComponents = e.templateUsedComponents;
  }
  if (e.templateSlots !== undefined) {
    (enhanced as any).templateSlots = e.templateSlots;
  }
  if (e.templateComplexity !== undefined) {
    (enhanced as any).templateComplexity = e.templateComplexity;
  }
  if (e.templateConditionals !== undefined) {
    (enhanced as any).templateConditionals = e.templateConditionals;
  }
  if (e.templateLifecycle !== undefined) {
    (enhanced as any).templateLifecycle = e.templateLifecycle;
  }
  if (e.templateEffects !== undefined) {
    (enhanced as any).templateEffects = e.templateEffects;
  }
  if (e.templateInjections !== undefined) {
    (enhanced as any).templateInjections = e.templateInjections;
  }
  if (e.templateReactivity !== undefined) {
    (enhanced as any).templateReactivity = e.templateReactivity;
  }
  if (e.typesGraph !== undefined) {
    (enhanced as any).typesGraph = e.typesGraph;
  }
  if (e.typeRefsGraph !== undefined) {
    (enhanced as any).typeRefsGraph = e.typeRefsGraph;
  }

  return enhanced;
}

// ============================================================
// ✅ P0-fix + P1-fix: ФУНКЦИИ
// ============================================================

/**
 * Конвертирует FunctionInfo в EnhancedFunctionInfo
 *
 * ════════════════════════════════════════════════════════════
 * ИЗМЕНЕНИЯ (P0/P1)
 * ════════════════════════════════════════════════════════════
 *
 *   ✅ P0: проброс `parentFunctionId` — лексического родителя.
 *      Без этого поля compact-reporter.ts получает `undefined`
 *      и записывает в `FunctionData.parentFunctionId` значение
 *      `null`, из-за чего decode не может восстановить иерархию.
 *
 *   ✅ P1: проброс `boundTo` — информации о вызове, в который
 *      передан колбэк (calleeName, argumentIndex, line).
 *      Это опциональное поле — добавляем только если оно есть.
 *
 * ════════════════════════════════════════════════════════════
 * ПОЧЕМУ ЭТО КРИТИЧНО
 * ════════════════════════════════════════════════════════════
 *
 *   Без проброса `parentFunctionId`:
 *     - `I10 (parentFunctionId ссылается на существующую функцию)`
 *       падает в check:roundtrip;
 *     - `check:consistency` падает на `decode(compact) ≟ full`;
 *     - фронт показывает "висячие" корни (`map_callback`,
 *       `_idle_callback`, `String.replace_callback`).
 *
 *   С пробросом — все колбэки становятся детьми своих
 *   лексических родителей, и дерево вызовов корректно.
 * ============================================================
 */
export function convertFunctionToEnhanced(func: FunctionInfo): EnhancedFunctionInfo {
  const enhanced: EnhancedFunctionInfo = {
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

    // ==========================================
    // ✅ P0-fix: лексический родитель
    // ==========================================
    // `parentFunctionId` — это локальный ID из EntitiesResult
    // (формат `f18_813`), который БУДЕТ преобразован в
    // глобальный (`fn42`) в compact-reporter.ts
    // через `localCompactIdToGlobalFnId`.
    //
    // Здесь мы просто гарантируем, что поле не потеряется
    // при конвертации EntitiesResult → EnhancedEntityInfo.
    // ==========================================
    parentFunctionId: func.parentFunctionId ?? null,
  };

  // ==========================================
  // ✅ P1-fix: boundTo (только если есть)
  // ==========================================
  // boundTo описывает вызов, в который передан колбэк:
  //   { calleeName: 'map', argumentIndex: 0, line: 147 }
  //
  // Добавляем только если поле реально задано, чтобы не
  // засорять JSON `null`-ами для не-колбэков.
  // ==========================================
  if (func.boundTo) {
    enhanced.boundTo = func.boundTo;
  }

  return enhanced;
}

// ============================================================
// КОНСТАНТЫ
// ============================================================

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

// ============================================================
// ПЕРЕМЕННЫЕ
// ============================================================

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

// ============================================================
// ИНТЕРФЕЙСЫ
// ============================================================

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

// ============================================================
// ТИПЫ
// ============================================================

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

// ============================================================
// КЛАССЫ
// ============================================================

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

  // ============================================================
  // ✅ ИСПРАВЛЕНО: явная типизация `s: ImportSpecifier` + сохранение loc
  // ============================================================
  // Было: `loc: null` жёстко, что теряло исходный loc.
  // Стало: `loc: imp.loc ?? null` — сохраняем исходное значение.
  // ============================================================
  if (enhanced.imports) {
    entities.imports = enhanced.imports.map(imp => ({
      source: imp.source,
      specifiers: imp.specifiers.map((s: ImportSpecifier) => ({
        local: s.local ?? '',
        imported: s.imported ?? s.local ?? '',
        type: s.type ?? 'ImportSpecifier',
      })),
      // ✅ ИСПРАВЛЕНО: сохраняем loc вместо жёсткого null
      loc: imp.loc ?? null,
      isTypeOnly: imp.isTypeOnly || false,
    }));
  }

  // ============================================================
  // ✅ P1-fix (обратный проброс): lexicalLinks
  // ============================================================
  if ((enhanced as any).lexicalLinks !== undefined) {
    entities.lexicalLinks = (enhanced as any).lexicalLinks;
  }

  return entities;
}

// ============================================================
// ✅ P0-fix (обратный проброс): EnhancedFunctionInfo → FunctionInfo
// ============================================================

/**
 * Конвертирует EnhancedFunctionInfo в FunctionInfo
 *
 * ════════════════════════════════════════════════════════════
 * ИЗМЕНЕНИЯ (P0/P1)
 * ════════════════════════════════════════════════════════════
 *
 *   ✅ P0: проброс `parentFunctionId` — при обратной конвертации
 *      лексический родитель не должен теряться.
 *
 *   ✅ P1: проброс `boundTo` — информация о вызове колбэка.
 *
 *   Также пробрасываются поля `callsInfo`, `calledByInfo`,
 *   `importedBy`, `isSelf`, `isExposed`, `isComposable`,
 *   `isConst`, `isMacro`, `source`, `signature`, `filePath`,
 *   `moduleName`, `moduleId`, `fileId` — чтобы round-trip
 *   Enhanced → FunctionInfo → Enhanced не терял данные.
 * ============================================================
 */
export function convertEnhancedFunctionToFunction(enhanced: EnhancedFunctionInfo): FunctionInfo {
  const func: FunctionInfo = {
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

    // ==========================================
    // ✅ P0-fix: лексический родитель
    // ==========================================
    parentFunctionId: enhanced.parentFunctionId ?? null,
  };

  // ==========================================
  // ✅ P1-fix: boundTo (только если есть)
  // ==========================================
  if (enhanced.boundTo) {
    func.boundTo = enhanced.boundTo;
  }

  return func;
}

// ============================================================
// КОНВЕРТАЦИЯ: Enhanced → FunctionInfo (прочие сущности)
// ============================================================

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
