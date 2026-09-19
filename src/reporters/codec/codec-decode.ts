// src/reporters/codec/codec-decode.ts
// ============================================
// ДЕКОДИРОВАНИЕ: CompactJSON → FullJSON
// ============================================
// Версия: 10.4.0
//
// ИЗМЕНЕНИЯ v10.4.0 (единая легенда для ИИ):
//   - ✅ ИСПРАВЛЕНО: пути к словарям изменились:
//       было:  legend.stringDict / legend.paramDict /
//              legend.methodDict / legend.valueDict
//       стало: legend.dictionaries.stringDict /
//              legend.dictionaries.paramDict /
//              legend.dictionaries.methodDict /
//              legend.dictionaries.valueDict
//     Причина: legend перестроена в codec-legend.ts для
//     самодостаточности ИИ (единая структура с how_to_read,
//     flags, codes, dictionaries, schemas).
//   - ✅ ДОБАВЛЕН fallback для чтения старых compact.json (v9.x),
//     где словари лежат на верхнем уровне legend.*
//   - ✅ ПРОЧЕЕ без изменений: логика декодирования кортежей,
//     восстановление edges (includeEdges), обработка BigInt-значений
//     через readValue (idx → valueDict[idx]) — всё как было.
//
// ИЗМЕНЕНИЯ v9.0.7 (round-trip fix):
//   - readMethod: idx < 0 → null (а не ''). Тип ClassData.methods
//     расширен до (string | null)[].
//   - templates[].conditionals: при отсутствии данных → [] (а не undefined).
//
// ИЗМЕНЕНИЯ v9.0.5 (v10.3 sync — full round-trip):
//   - imports[].type для type-only импортов: 'type' (не 'type-only').
//   - Удаление пустых опциональных секций.
//
// ИЗМЕНЕНИЯ v9.0.4 (includeEdges default false):
//   - decode, options.includeEdges по умолчанию false.
//
// ИЗМЕНЕНИЯ v9.0.3 (gr.c fix):
//   - decode, секция calls: деструктуризация 5 элементов,
//     ветвление по isExternal (0 = functionIdx, 1 = stringDictIdx).
//
// ИЗМЕНЕНИЯ v9.0.2 (reversibility):
//   - decodeFlagsToObject: возвращает все 18 флагов
//   - decode, секция fns: копирует все 18 флагов (только true)
//   - decode, секция calls: external определяется по stringDict
//   - decode, секция exports: +2 поля (isStarReExport, isDefaultReExport)
//   - decode, секция modules: +1 поле (path)
// ============================================

import type {
  FullJSON,
  CompactJSON,
  FunctionData,
  ClassData,
  ConstantData,
  ExportData,
  ImportData,
  CallData,
  ReExportData,
  ModuleData,
  FileData,
  TemplateData,
  TemplateConditional,
  LifecycleHook,
  EffectEdge,
  InjectionEdge,
  ReactivityEdge,
  TypeNodeData,
  TypeRefData,
  EdgeData,
  DecodeOptions,
  CodecLegend,
} from './codec-types.js';

import {
  EXPORT_TYPES,
  IMPORT_TYPES,
  CALL_TYPES,
  RE_EXPORT_TYPES,
  LIFECYCLE_TYPES,
  EFFECT_TYPES,
  INJECTION_TYPES,
  REACTIVITY_TYPES,
  CONDITIONAL_TYPES,
  TYPE_KINDS,
  TYPE_USAGE_KINDS,
} from './codec-encode.js';

// ============================================
// ДЕКОДИРОВАНИЕ ФЛАГОВ
// ============================================

/**
 * Результат декодирования битовых флагов функции.
 *
 * Содержит все 18 возможных флагов (см. FLAG_MAP в codec-encode.ts).
 */
export interface DecodedFlags {
  isAsync: boolean;
  isExported: boolean;
  isMethod: boolean;
  isArrow: boolean;
  isEventHandler: boolean;
  isNested: boolean;
  isSelf: boolean;
  isDynamic: boolean;
  isConfig: boolean;
  isExternal: boolean;
  isVueTemplate: boolean;
  isAsyncChain: boolean;
  isClosure: boolean;
  isTypeDep: boolean;
  isGenerator: boolean;
  isPrivate: boolean;
  isProtected: boolean;
  isStatic: boolean;
}

/**
 * Создаёт «пустой» объект флагов (все false).
 */
export function createEmptyFlags(): DecodedFlags {
  return {
    isAsync: false,
    isExported: false,
    isMethod: false,
    isArrow: false,
    isEventHandler: false,
    isNested: false,
    isSelf: false,
    isDynamic: false,
    isConfig: false,
    isExternal: false,
    isVueTemplate: false,
    isAsyncChain: false,
    isClosure: false,
    isTypeDep: false,
    isGenerator: false,
    isPrivate: false,
    isProtected: false,
    isStatic: false,
  };
}

/**
 * Декодирует строку символов в число флагов.
 *
 * Символы соответствуют FLAG_CHAR_MAP из codec-encode.ts:
 *   a=1, e=2, m=4, r=8, v=16, n=32, s=64, d=128, c=256, x=512,
 *   t=1024, A=2048, l=4096, y=8192, g=16384, p=32768, P=65536, S=131072
 *
 * ⚠️ v10.4.0: локальная копия FLAG_CHAR_MAP. Не зависит от legend.
 *    Легенда используется только для ИИ. Декодер работает автономно.
 *
 * @param flagStr — строка флагов, например 'em' или 'evl'
 * @returns число флагов
 */
export function flagsStringToNumber(flagStr: string): number {
  if (!flagStr || flagStr === '0') return 0;

  const FLAG_CHAR_MAP: Record<string, number> = {
    a: 1,
    e: 2,
    m: 4,
    r: 8,
    v: 16,
    n: 32,
    s: 64,
    d: 128,
    c: 256,
    x: 512,
    t: 1024,
    A: 2048,
    l: 4096,
    y: 8192,
    g: 16384,
    p: 32768,
    P: 65536,
    S: 131072,
  };

  let flags = 0;
  for (const char of flagStr) {
    const bit = FLAG_CHAR_MAP[char];
    if (bit !== undefined) flags |= bit;
  }
  return flags;
}

/**
 * Декодирует строку символов в объект с булевыми полями.
 *
 * ✅ ИСПРАВЛЕНО (reversibility):
 *   Возвращает все 18 флагов. Ранее decode в codec.ts
 *   использовал только 4 поля (isAsync, isExported, isArrow, isMethod),
 *   остальные 14 флагов терялись.
 */
export function decodeFlagsToObject(flagStr: string): DecodedFlags {
  const result = createEmptyFlags();
  if (!flagStr || flagStr === '0') return result;

  const flags = flagsStringToNumber(flagStr);

  result.isAsync = !!(flags & 1);
  result.isExported = !!(flags & 2);
  result.isMethod = !!(flags & 4);
  result.isArrow = !!(flags & 8);
  result.isEventHandler = !!(flags & 16);
  result.isNested = !!(flags & 32);
  result.isSelf = !!(flags & 64);
  result.isDynamic = !!(flags & 128);
  result.isConfig = !!(flags & 256);
  result.isExternal = !!(flags & 512);
  result.isVueTemplate = !!(flags & 1024);
  result.isAsyncChain = !!(flags & 2048);
  result.isClosure = !!(flags & 4096);
  result.isTypeDep = !!(flags & 8192);
  result.isGenerator = !!(flags & 16384);
  result.isPrivate = !!(flags & 32768);
  result.isProtected = !!(flags & 65536);
  result.isStatic = !!(flags & 131072);

  return result;
}

// ============================================
// ✅ v10.4.0: ХЕЛПЕР ДЛЯ ДОСТУПА К СЛОВАРЯМ
// ============================================
//
// Легенда v10.4.0 имеет структуру:
//   legend.dictionaries.stringDict
//   legend.dictionaries.paramDict
//   legend.dictionaries.methodDict
//   legend.dictionaries.valueDict
//
// Легенда v9.x имела словари на верхнем уровне:
//   legend.stringDict
//   legend.paramDict
//   legend.methodDict
//   legend.valueDict
//
// Функция resolveDictionaries() возвращает словари из любого
// варианта легенды — это обеспечивает обратную совместимость
// при чтении старых compact.json.
// ============================================

interface ResolvedDictionaries {
  stringDict: string[];
  paramDict: string[];
  methodDict: string[];
  valueDict: unknown[];
}

/**
 * Извлекает словари из легенды, поддерживая оба формата:
 *   - v10.4.0: legend.dictionaries.{stringDict,paramDict,methodDict,valueDict}
 *   - v9.x:    legend.{stringDict,paramDict,methodDict,valueDict}
 *
 * @param legend — легенда из compact.json
 * @returns нормализованный объект со словарями
 */
function resolveDictionaries(legend: CodecLegend): ResolvedDictionaries {
  // v10.4.0: словари в legend.dictionaries.*
  const modern = (legend as unknown as { dictionaries?: ResolvedDictionaries }).dictionaries;
  if (modern && Array.isArray(modern.stringDict)) {
    return {
      stringDict: modern.stringDict,
      paramDict: Array.isArray(modern.paramDict) ? modern.paramDict : [],
      methodDict: Array.isArray(modern.methodDict) ? modern.methodDict : [],
      valueDict: Array.isArray(modern.valueDict) ? modern.valueDict : [],
    };
  }

  // v9.x: словари на верхнем уровне legend.*
  const legacy = legend as unknown as {
    stringDict?: string[];
    paramDict?: string[];
    methodDict?: string[];
    valueDict?: unknown[];
  };

  return {
    stringDict: Array.isArray(legacy.stringDict) ? legacy.stringDict : [],
    paramDict: Array.isArray(legacy.paramDict) ? legacy.paramDict : [],
    methodDict: Array.isArray(legacy.methodDict) ? legacy.methodDict : [],
    valueDict: Array.isArray(legacy.valueDict) ? legacy.valueDict : [],
  };
}

// ============================================
// ОСНОВНАЯ ФУНКЦИЯ DECODE
// ============================================

/**
 * Декодирует сжатый JSON обратно в полный.
 *
 * ✅ ИСПРАВЛЕНО (v10.4.0, единая легенда):
 *   Словари читаются через resolveDictionaries(legend), что
 *   поддерживает и новую структуру (legend.dictionaries.*),
 *   и старую (legend.stringDict и т.д. на верхнем уровне).
 *
 * ✅ ИСПРАВЛЕНО (v9.0.4, includeEdges default false):
 *   Поле edges — производное (восстанавливается из gr.i + gr.e + gr.c + gr.re).
 *   По умолчанию edges НЕ добавляются в результат — это устраняет расхождение
 *   при DL (decode(encode(full)) === full), когда исходный full не содержит edges
 *   (как и должно быть по спецификации v9.0.x).
 *
 *   Если edges нужны (например, для отдельного файла *.edges.json) —
 *   передайте { includeEdges: true } в DecodeOptions.
 *
 * ✅ ИСПРАВЛЕНО (v9.0.3, gr.c fix):
 *   External-вызовы определяются по isExternal === 1,
 *   а не по содержимому stringDict. Это устраняет коллизию
 *   индексов: functionIdx и stringDictIdx теперь не смешиваются.
 *
 * ✅ ИСПРАВЛЕНО (reversibility):
 *   - modules[].path восстанавливается из mi[id].p
 *   - functions[].*Flags восстанавливаются все 18
 *   - exports[].isStarReExport / isDefaultReExport восстанавливаются
 *
 * ✅ ИСПРАВЛЕНО (v9.0.7, round-trip fix):
 *   - readMethod: idx < 0 → null (а не ''). Устраняет расхождение
 *     $.classes[N].methods[M]: a="" vs b=null. Тип ClassData.methods
 *     расширен до (string | null)[].
 *   - templates[].conditionals: при отсутствии данных → [] (а не undefined).
 *     Устраняет расхождение $.templates[N].conditionals: a=undefined vs b=[].
 *
 * @param compact — сжатый JSON с легендой
 * @param options — опции декодирования
 * @returns полный JSON
 */
export function decode(compact: CompactJSON, options: DecodeOptions = {}): FullJSON {
  const {
    // ✅ v9.0.4: includeEdges по умолчанию false.
    // Раньше было true — это приводило к расхождению DL,
    // когда исходный full не содержал edges.
    includeEdges = false,
    includeEmptyArrays = true,
    includeStatistics = true,
  } = options;

  const legend = compact.legend;

  // ============================================
  // ✅ v10.4.0: Разрешение словарей
  // ============================================
  // Поддерживаем и legend.dictionaries.* (v10.4.0),
  // и legend.* (v9.x) — для обратной совместимости.
  // ============================================
  const dictionaries = resolveDictionaries(legend);

  // ============================================
  // Хелперы для чтения словарей
  // ============================================

  const readString = (idx: number): string | undefined =>
    idx < 0 ? undefined : dictionaries.stringDict[idx];

  const readStringOrEmpty = (idx: number): string =>
    idx < 0 ? '' : (dictionaries.stringDict[idx] ?? '');

  const readParam = (idx: number): string => (idx < 0 ? '' : (dictionaries.paramDict[idx] ?? ''));

  // ✅ v9.0.7: возвращаем null при idx < 0, а не ''.
  // Это симметрично full.json, где method name может быть null.
  // Тип ClassData.methods расширен до (string | null)[].
  const readMethod = (idx: number): string | null =>
    idx < 0 ? null : (dictionaries.methodDict[idx] ?? null);

  const readValue = (idx: number): unknown => (idx < 0 ? undefined : dictionaries.valueDict[idx]);

  // ============================================
  // 1. Модули — с path (reversibility)
  // ============================================
  const modules: ModuleData[] = Object.entries(compact.mi).map(([id, data]) => ({
    id,
    name: data.n,
    path: data.p, // ✅ reversibility: используем сохранённый path
    fileIds: [...data.f],
  }));

  // ============================================
  // 2. Файлы
  // ============================================
  const files: FileData[] = Object.entries(compact.fl).map(([id, data]) => ({
    id,
    path: data.p,
    moduleId: data.m,
  }));

  // ============================================
  // 3. Функции — все 18 флагов (reversibility)
  // ============================================
  const functions: FunctionData[] = (compact.fns || []).map(
    ([id, name, moduleId, fileId, line, flagsStr, paramsIdx, returnTypeIdx]) => {
      const flags = decodeFlagsToObject(flagsStr);

      const func: FunctionData = {
        id,
        name,
        moduleId,
        fileId,
        line,
        isExported: flags.isExported,
        isAsync: flags.isAsync,
        isArrow: flags.isArrow,
        isMethod: flags.isMethod,
        params: (paramsIdx || []).map(readParam),
        returnType: readString(returnTypeIdx),
      };

      // ✅ reversibility: копируем остальные флаги, только если они true.
      // В full для не-установленных флагов поля отсутствуют (undefined),
      // а не false. Если записать false, deepEqual(full, decoded) покажет
      // расхождение.
      if (flags.isEventHandler) func.isEventHandler = true;
      if (flags.isNested) func.isNested = true;
      if (flags.isSelf) func.isSelf = true;
      if (flags.isDynamic) func.isDynamic = true;
      if (flags.isConfig) func.isConfig = true;
      if (flags.isExternal) func.isExternal = true;
      if (flags.isVueTemplate) func.isVueTemplate = true;
      if (flags.isAsyncChain) func.isAsyncChain = true;
      if (flags.isClosure) func.isClosure = true;
      if (flags.isTypeDep) func.isTypeDep = true;
      if (flags.isGenerator) func.isGenerator = true;
      if (flags.isPrivate) func.isPrivate = true;
      if (flags.isProtected) func.isProtected = true;
      if (flags.isStatic) func.isStatic = true;

      return func;
    }
  );

  // ============================================
  // 4. Классы
  // ============================================
  const classes: ClassData[] = (compact.cls || []).map(
    ([id, name, moduleId, fileId, line, flagsStr, methodsIdx]) => {
      const flags = decodeFlagsToObject(flagsStr);
      return {
        id,
        name,
        moduleId,
        fileId,
        line,
        isExported: flags.isExported,
        // ✅ v9.0.7: readMethod возвращает null при idx < 0,
        // что согласовано с full.json (где method name может быть null).
        methods: (methodsIdx || []).map(readMethod),
      };
    }
  );

  // ============================================
  // 5. Константы
  // ============================================
  const constants: ConstantData[] = (compact.cn || []).map(
    ([id, name, moduleId, fileId, line, flagsStr, valueIdx]) => {
      const flags = decodeFlagsToObject(flagsStr);
      return {
        id,
        name,
        moduleId,
        fileId,
        line,
        isExported: flags.isExported,
        value: readValue(valueIdx),
      };
    }
  );

  // ============================================
  // 6. Экспорты — 12 полей (reversibility)
  // ============================================
  const exports: ExportData[] = (compact.gr?.e || []).map(
    (
      [
        moduleIdx,
        fileIdx,
        funcIdx,
        line,
        typeCode,
        exportNameIdx,
        localNameIdx,
        isTypeOnly,
        isReExport,
        sourceIdx,
        isStarReExport, // ✅ reversibility
        isDefaultReExport, // ✅ reversibility
      ],
      idx
    ) => ({
      id: `e${idx + 1}`,
      moduleId: `m${moduleIdx}`,
      fileId: `f${fileIdx}`,
      functionId: `fn${funcIdx}`,
      exportName: readStringOrEmpty(exportNameIdx),
      localName: readStringOrEmpty(localNameIdx),
      line,
      type: (EXPORT_TYPES[typeCode] || 'named') as ExportData['type'],
      isDefault: typeCode === 'de',
      isTypeOnly: isTypeOnly === 1,
      isReExport: isReExport === 1,
      isStarReExport: isStarReExport === 1,
      isDefaultReExport: isDefaultReExport === 1,
      source: readString(sourceIdx),
    })
  );

  // ============================================
  // 7. Импорты
  // ============================================
  // ✅ v9.0.5 / v10.3 sync: type-only импорты декодируются как 'type',
  //    а не 'type-only'. Это согласовано с compact-reporter.ts,
  //    который пишет `type: 'type'` для type-only импортов
  //    (см. ImportData.type в codec-types.ts).
  // ============================================
  const imports: ImportData[] = (compact.gr?.i || []).map(
    (
      [
        fromFileIdx,
        toFileIdIdx,
        sourceIdx,
        importedNameIdx,
        localNameIdx,
        line,
        typeCode,
        isExternal,
      ],
      idx
    ) => {
      const source = readStringOrEmpty(sourceIdx);
      const toFileId = readString(toFileIdIdx) ?? null;

      // ✅ v10.3: typeCode 'to' → type: 'type'.
      // Раньше возвращалось 'type-only', что расходилось с compact-reporter.ts,
      // который пишет 'type' для type-only импортов (см. ImportData.type).
      // Теперь обе стороны согласованы: 'type'.
      const importType: ImportData['type'] =
        typeCode === 'to' ? 'type' : ((IMPORT_TYPES[typeCode] || 'named') as ImportData['type']);

      return {
        id: `i${idx + 1}`,
        fromFileId: `f${fromFileIdx}`,
        toFileId,
        source,
        importedName: readStringOrEmpty(importedNameIdx),
        localName: readStringOrEmpty(localNameIdx),
        line,
        type: importType,
        isDefault: typeCode === 'df',
        isNamespace: typeCode === 'ns',
        isTypeOnly: typeCode === 'to',
        isExternal: isExternal === 1,
        packageName:
          isExternal === 1
            ? source.startsWith('@')
              ? source.split('/').slice(0, 2).join('/')
              : source.split('/')[0]
            : undefined,
      };
    }
  );

  // ============================================
  // 8. Вызовы (gr.c)
  // ============================================
  // ✅ v9.0.3: isExternal явно отделяет два случая:
  //   - isExternal === 1 → toIdx это stringDictIdx → readStringOrEmpty
  //   - isExternal === 0 → toIdx это functionIdx  → `fn${toIdx}`
  // Это устраняет коллизию индексов.
  // ============================================
  const calls: CallData[] = (compact.gr?.c || []).map(
    ([fromIdx, toIdx, line, typeChar, isExternal], idx) => {
      const toFunctionId = isExternal === 1 ? readStringOrEmpty(toIdx) : `fn${toIdx}`;

      const callType = (CALL_TYPES[typeChar] || 'direct') as CallData['type'];

      return {
        id: `c${idx + 1}`,
        fromFunctionId: `fn${fromIdx}`,
        toFunctionId,
        line,
        type: callType,
      };
    }
  );

  // ============================================
  // 9. Реэкспорты
  // ============================================
  const reExports: ReExportData[] = (compact.gr?.re || []).map(
    ([moduleIdx, funcIdx, sourceIdx, exportNameIdx, line, typeCode, isTypeOnly], idx) => ({
      id: `re${idx + 1}`,
      moduleId: `m${moduleIdx}`,
      functionId: `fn${funcIdx}`,
      source: readStringOrEmpty(sourceIdx),
      exportName: readStringOrEmpty(exportNameIdx),
      line,
      type: (RE_EXPORT_TYPES[typeCode] || 'named') as ReExportData['type'],
      isDefault: typeCode === 'df',
      isTypeOnly: isTypeOnly === 1,
      isStarReExport: typeCode === 'all',
    })
  );

  // ============================================
  // 10. Conditionals
  // ============================================
  const conditionals: TemplateConditional[] | undefined = compact.cd
    ? compact.cd.map(([directiveCode, fileIdx, line, condIdx, compIdx], idx) => ({
        id: `cd${idx + 1}`,
        directive: (CONDITIONAL_TYPES[directiveCode] || 'v-if') as TemplateConditional['directive'],
        fileId: `f${fileIdx}`,
        line,
        conditionExpression: condIdx >= 0 ? readString(condIdx) : undefined,
        renderedComponent: compIdx >= 0 ? readString(compIdx) : undefined,
      }))
    : undefined;

  // ============================================
  // 11. Vue templates
  // ============================================
  const templates: TemplateData[] = (compact.vt || []).map(
    ([
      fileIdx,
      moduleIdx,
      complexity,
      reactivityDepsIdx,
      eventHandlers,
      dynamicComponents,
      directivesIdx,
      usedComponentsIdx,
      templateRefs,
      cssVariables,
      deepSelectors,
      slotsIdx,
    ]) => {
      const fileId = `f${fileIdx}`;

      return {
        fileId,
        moduleId: `m${moduleIdx}`,
        complexity,
        reactivityDeps: (reactivityDepsIdx || []).map(readStringOrEmpty),
        eventHandlers: (eventHandlers || []).map(
          ([eventNameIdx, handlerNameIdx, tagIdx, line, modifiersIdx, isExternal]) => ({
            eventName: readStringOrEmpty(eventNameIdx),
            handlerName: readStringOrEmpty(handlerNameIdx),
            tag: readStringOrEmpty(tagIdx),
            line,
            modifiers: (modifiersIdx || []).map(readStringOrEmpty),
            isExternal: isExternal === 1,
          })
        ),
        dynamicComponents: (dynamicComponents || []).map(
          ([isExpressionIdx, line, resolvedComponentsIdx]) => ({
            isExpression: readStringOrEmpty(isExpressionIdx),
            line,
            resolvedComponents: (resolvedComponentsIdx || [])
              .map(readStringOrEmpty)
              .filter((s: string) => s !== ''),
          })
        ),
        directives: (directivesIdx || []).map(readStringOrEmpty),
        usedComponents: (usedComponentsIdx || []).map(readStringOrEmpty),
        templateRefs: (templateRefs || []).map(
          ([refValueIdx, tagIdx, line, exposedMethodsIdx]) => ({
            refValue: readStringOrEmpty(refValueIdx),
            tag: readStringOrEmpty(tagIdx),
            line,
            exposedMethods: (exposedMethodsIdx || []).map(readStringOrEmpty),
          })
        ),
        cssVariables: (cssVariables || []).map(([nameIdx, valueIdx, line, isMultiline]) => ({
          name: readStringOrEmpty(nameIdx),
          value: valueIdx >= 0 ? readStringOrEmpty(valueIdx) : undefined,
          line,
          isMultiline: isMultiline === 1,
        })),
        deepSelectors: (deepSelectors || []).map(([selectorIdx, line]) => ({
          selector: readStringOrEmpty(selectorIdx),
          line,
        })),
        slots: (slotsIdx || []).map(readStringOrEmpty),
        // ✅ v9.0.7: если conditionals === undefined, возвращаем []
        // (а не undefined). Это согласовано с compact-reporter.ts,
        // который всегда пишет conditionals как [] в TemplateData.
        conditionals: conditionals
          ? conditionals
              .filter(c => c.fileId === fileId)
              .map(c => ({
                id: c.id,
                directive: c.directive,
                fileId: c.fileId,
                line: c.line,
                conditionExpression: c.conditionExpression,
                renderedComponent: c.renderedComponent,
              }))
          : [],
      };
    }
  );

  // ============================================
  // 12. Lifecycle
  // ============================================
  const lifecycle: LifecycleHook[] | undefined = compact.lc
    ? compact.lc.map(([hookCode, funcIdx, line, callbackFnIdx, flagsStr], idx) => ({
        id: `lc${idx + 1}`,
        hookName: (LIFECYCLE_TYPES[hookCode] || 'onMounted') as LifecycleHook['hookName'],
        functionId: funcIdx >= 0 ? `fn${funcIdx}` : '',
        line,
        callbackFunctionId: callbackFnIdx >= 0 ? `fn${callbackFnIdx}` : undefined,
        isSetupContext: flagsStr === 's',
      }))
    : undefined;

  // ============================================
  // 13. Effects
  // ============================================
  const effects: EffectEdge[] | undefined = compact.ef
    ? compact.ef.map(([effectCode, funcIdx, line, targetIdx, metaIdx], idx) => ({
        id: `ef${idx + 1}`,
        effectType: (EFFECT_TYPES[effectCode] || 'timer') as EffectEdge['effectType'],
        functionId: funcIdx >= 0 ? `fn${funcIdx}` : '',
        line,
        targetName: readStringOrEmpty(targetIdx),
        metaValue: metaIdx >= 0 ? readStringOrEmpty(metaIdx) : undefined,
      }))
    : undefined;

  // ============================================
  // 14. Injections
  // ============================================
  const injections: InjectionEdge[] | undefined = compact.inj
    ? compact.inj.map(([kindCode, fileIdx, line, keyIdx, flags], idx) => ({
        id: `in${idx + 1}`,
        kind: (INJECTION_TYPES[kindCode] || 'provide') as InjectionEdge['kind'],
        fileId: `f${fileIdx}`,
        line,
        key: readStringOrEmpty(keyIdx),
        isSymbolKey: (flags & 1) !== 0,
        hasDefault: (flags & 2) !== 0,
      }))
    : undefined;

  // ============================================
  // 15. Reactivity
  // ============================================
  const reactivity: ReactivityEdge[] | undefined = compact.rx
    ? compact.rx.map(([kindCode, funcIdx, line, readsIdx, writesIdx, flags], idx) => ({
        id: `rx${idx + 1}`,
        kind: (REACTIVITY_TYPES[kindCode] || 'computed') as ReactivityEdge['kind'],
        functionId: funcIdx >= 0 ? `fn${funcIdx}` : '',
        line,
        reads: (readsIdx || []).map(readStringOrEmpty),
        writes: (writesIdx || []).map(readStringOrEmpty),
        isWriteable: flags === 1,
      }))
    : undefined;

  // ============================================
  // 16. Types
  // ============================================
  const types: TypeNodeData[] | undefined = compact.ty
    ? compact.ty.map(
        ([kindCode, nameIdx, moduleIdx, fileIdx, line, membersIdx, extendsIdx], idx) => ({
          id: `t${idx + 1}`,
          kind: (TYPE_KINDS[kindCode] || 'interface') as TypeNodeData['kind'],
          name: readStringOrEmpty(nameIdx),
          moduleId: `m${moduleIdx}`,
          fileId: `f${fileIdx}`,
          line,
          members: (membersIdx || []).map(readStringOrEmpty),
          extendsTypes: (extendsIdx || []).map(readStringOrEmpty),
        })
      )
    : undefined;

  // ============================================
  // 17. TypeRefs
  // ============================================
  const typeRefs: TypeRefData[] | undefined = compact.tr
    ? compact.tr.map(([typeNameIdx, moduleIdx, fileIdx, line, usageCode], idx) => ({
        id: `tr${idx + 1}`,
        typeName: readStringOrEmpty(typeNameIdx),
        moduleId: `m${moduleIdx}`,
        fileId: `f${fileIdx}`,
        line,
        usageKind: (TYPE_USAGE_KINDS[usageCode] || 'param') as TypeRefData['usageKind'],
      }))
    : undefined;

  // ============================================
  // 18. Статистика
  // ============================================
  const statistics = compact.st;

  // ============================================
  // 19. Edges — восстанавливаются ТОЛЬКО если includeEdges === true
  // ============================================
  // ✅ v9.0.4: по умолчанию edges НЕ восстанавливаются.
  //
  // Поле edges — производное: его можно собрать из gr.i + gr.e + gr.c + gr.re.
  // Хранить его в full.json нет смысла (дублирование данных и расхождение
  // при round-trip, если исходный full не содержит edges).
  //
  // Если edges нужны (например, для отдельного файла *.edges.json) —
  // передайте includeEdges: true в DecodeOptions.
  // ============================================
  const shouldIncludeEdges = includeEdges === true;

  const edges: EdgeData[] = [];

  if (shouldIncludeEdges) {
    for (const imp of imports) {
      edges.push({
        from: imp.fromFileId,
        to: imp.toFileId || 'unknown',
        type: 'import',
        symbol: imp.importedName,
        line: imp.line,
      });
    }

    for (const exp of exports) {
      edges.push({
        from: exp.fileId,
        to: exp.functionId,
        type: 'export',
        symbol: exp.exportName,
        line: exp.line,
      });
    }

    for (const call of calls) {
      edges.push({
        from: call.fromFunctionId,
        to: call.toFunctionId,
        type: 'call',
        line: call.line,
      });
    }

    for (const re of reExports) {
      edges.push({
        from: re.moduleId,
        to: re.functionId,
        type: 're-export',
        symbol: re.exportName,
        line: re.line,
      });
    }
  }

  // ============================================
  // 20. Сборка результата
  // ============================================
  const result: FullJSON = {
    version: compact.v,
    timestamp: compact.ts,
    root: compact.r,
    modules,
    files,
    functions,
    classes,
    constants,
    exports,
    imports,
    calls,
    reExports,
    templates: templates.length > 0 ? templates : undefined,
    statistics: includeStatistics ? statistics : ({} as any),
    lifecycle,
    effects,
    injections,
    reactivity,
    conditionals,
    types,
    typeRefs,
    // edges добавляется ТОЛЬКО ниже, если shouldIncludeEdges === true
  };

  if (!includeEmptyArrays) {
    if (modules.length === 0) delete (result as any).modules;
    if (files.length === 0) delete (result as any).files;
    if (functions.length === 0) delete (result as any).functions;
    if (classes.length === 0) delete (result as any).classes;
    if (constants.length === 0) delete (result as any).constants;
    if (exports.length === 0) delete (result as any).exports;
    if (imports.length === 0) delete (result as any).imports;
    if (calls.length === 0) delete (result as any).calls;
    if (reExports.length === 0) delete (result as any).reExports;
    if (templates.length === 0) delete (result as any).templates;

    if (!lifecycle) delete (result as any).lifecycle;
    if (!effects) delete (result as any).effects;
    if (!injections) delete (result as any).injections;
    if (!reactivity) delete (result as any).reactivity;
    if (!conditionals) delete (result as any).conditionals;
    if (!types) delete (result as any).types;
    if (!typeRefs) delete (result as any).typeRefs;
  }

  // ============================================
  // ✅ v10.3: удаляем пустые ОПЦИОНАЛЬНЫЕ секции, если их не было в compact.
  // Это симметрично compact-reporter.ts, который пишет undefined для пустых
  // templates/conditionals/lifecycle/effects/injections/reactivity/types/typeRefs.
  //
  // Базовые секции (classes/constants/exports/imports/calls/reExports)
  // НЕ удаляем — они всегда массивы (даже пустые), как в compact-reporter.ts
  // после v10.3 (в collectFullJSON эти поля присваиваются без
  // length>0 ? x : undefined).
  // ============================================
  if (!compact.vt) delete (result as any).templates;
  if (!compact.cd) delete (result as any).conditionals;
  if (!compact.lc) delete (result as any).lifecycle;
  if (!compact.ef) delete (result as any).effects;
  if (!compact.inj) delete (result as any).injections;
  if (!compact.rx) delete (result as any).reactivity;
  if (!compact.ty) delete (result as any).types;
  if (!compact.tr) delete (result as any).typeRefs;

  if (shouldIncludeEdges && edges.length > 0) {
    result.edges = edges;
  }

  return result;
}

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

export default decode;
