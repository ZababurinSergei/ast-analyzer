// packages/ast-analyzer/src/reporters/json/relationships/optimized-relationships.ts

import type { EntitiesResult } from '../../../types.js';
import type { CallInfo, CalledByInfo, ImportedByInfo } from '../../../types.js';
import { generateFileId } from '../utils/id-generator.js';
import { collectImporters } from '../importers/importers-collector.js';
import idManager from '../../../core/IdManager.js';

// ============================================================
// ТИПЫ
// ============================================================

/**
 * Публичный результат функции — три карты связей по ID сущности.
 *
 * Ключ во всех трёх картах — уникальный ID функции
 * (обычно вида `func_<hash>_<name>`, генерируемый IdManager).
 */
export interface FunctionRelationships {
  /** Кого вызывает эта функция */
  calls: Record<string, CallInfo[]>;
  /** Кто вызывает эту функцию */
  calledBy: Record<string, CalledByInfo[]>;
  /** Из каких файлов эта функция импортируется */
  importedBy: Record<string, ImportedByInfo[]>;
}

/**
 * Запись в индексе функций: краткая информация для построения связей.
 */
interface FunctionIndexEntry {
  id: string;
  file: string;
  line: number;
  vscode: string;
}

/**
 * Запись в индексе файлов.
 */
interface FileIndexEntry {
  id: string;
  vscode: string;
}

// ============================================================
// ОСНОВНАЯ ПУБЛИЧНАЯ ФУНКЦИЯ
// ============================================================

/**
 * Строит отношения между функциями:
 *   - calls:      кто кого вызывает (исходящие)
 *   - calledBy:   кто вызывает эту функцию (входящие)
 *   - importedBy: из каких файлов функция импортируется
 *
 * Используется в saveOptimizedPackageLockReport для встраивания
 * связей прямо в сущности (вместо отдельных секций графа).
 *
 * Этапы:
 *   1. Построение индексов функций и файлов
 *   2. Построение карты calls
 *   3. Построение карты calledBy (обратные ссылки из calls)
 *   4. Построение карты importedBy (через collectImporters)
 *
 * @param entitiesMap — карта модуль → EntitiesResult
 * @param graph       — граф зависимостей проекта
 * @returns FunctionRelationships — три карты связей
 */
export function buildOptimizedRelationships(
  entitiesMap: Record<string, EntitiesResult>,
  graph: Record<string, string[]>
): FunctionRelationships {
  const relationships: FunctionRelationships = {
    calls: {},
    calledBy: {},
    importedBy: {},
  };

  // ────────────────────────────────────────────────────────
  // Шаг 1: Построение индексов
  // ────────────────────────────────────────────────────────
  // ✅ ИСПРАВЛЕНО: убрана неиспользуемая переменная `fileIndex`
  // из деструктуризации. Функция `buildIndices` по-прежнему
  // возвращает оба индекса (funcIndex и fileIndex), но здесь
  // нам нужен только funcIndex.
  // ────────────────────────────────────────────────────────
  const { funcIndex } = buildIndices(entitiesMap);

  // ────────────────────────────────────────────────────────
  // Шаг 2: Построение карты calls
  // ────────────────────────────────────────────────────────
  buildCallsMap(entitiesMap, funcIndex, relationships.calls);

  // ────────────────────────────────────────────────────────
  // Шаг 3: Построение карты calledBy
  // ────────────────────────────────────────────────────────
  buildCalledByMap(entitiesMap, relationships.calls, relationships.calledBy);

  // ────────────────────────────────────────────────────────
  // Шаг 4: Построение карты importedBy
  // ────────────────────────────────────────────────────────
  buildImportedByMap(entitiesMap, graph, relationships.importedBy);

  return relationships;
}

// ============================================================
// ШАГ 1: ИНДЕКСЫ ФУНКЦИЙ И ФАЙЛОВ
// ============================================================

/**
 * Строит индексы:
 *   - funcIndex:  имя функции → { id, file, line, vscode }
 *   - fileIndex:  путь файла  → { id, vscode }
 *
 * Используется для быстрого поиска целевой функции по имени
 * при построении карты calls.
 */
function buildIndices(entitiesMap: Record<string, EntitiesResult>): {
  funcIndex: Record<string, FunctionIndexEntry>;
  fileIndex: Record<string, FileIndexEntry>;
} {
  const funcIndex: Record<string, FunctionIndexEntry> = {};
  const fileIndex: Record<string, FileIndexEntry> = {};

  for (const [filePath, entities] of Object.entries(entitiesMap)) {
    // Индекс файлов
    fileIndex[filePath] = {
      id: generateFileId(filePath),
      vscode: `vscode://file/${filePath}`,
    };

    // Индекс функций
    for (const func of entities.functions || []) {
      const id = resolveFunctionId(func, filePath);
      funcIndex[func.name] = {
        id,
        file: filePath,
        line: func.line || 0,
        vscode: `vscode://file/${filePath}:${func.line}`,
      };
    }
  }

  return { funcIndex, fileIndex };
}

/**
 * Возвращает ID функции: берёт готовый из func.id либо генерирует
 * через IdManager. Это нужно, потому что не все источники сущностей
 * заполняют поле id (например, сущности из ast-parser.ts до рефакторинга).
 */
function resolveFunctionId(func: any, filePath: string): string {
  if (func.id) return func.id;

  return idManager.getFunctionId({
    filePath,
    funcName: func.name,
    line: func.line || 0,
    parentFunction: func.parentFunction,
    depth: func.depth || 0,
  });
}

// ============================================================
// ШАГ 2: КАРТА CALLS
// ============================================================

/**
 * Строит карту calls:
 *   calls[callerId] = [CallInfo, CallInfo, ...]
 *
 * Для каждого вызова в `func.calls` пытается найти целевую функцию:
 *   1. Сначала в funcIndex (по имени)
 *   2. Если не найдена — поиск по всем модулям (импортированные функции)
 *   3. Если совсем не найдена — записывает заглушку с targetId = 'unknown'
 */
function buildCallsMap(
  entitiesMap: Record<string, EntitiesResult>,
  funcIndex: Record<string, FunctionIndexEntry>,
  callsMap: Record<string, CallInfo[]>
): void {
  for (const [filePath, entities] of Object.entries(entitiesMap)) {
    for (const func of entities.functions || []) {
      const callerId = resolveFunctionId(func, filePath);
      callsMap[callerId] = [];

      const callNames = func.calls || [];

      for (const callName of callNames) {
        const callInfo = resolveCallInfo(callName, func, filePath, entitiesMap, funcIndex);
        callsMap[callerId].push(callInfo);
      }
    }
  }
}

/**
 * Разрешает один вызов: возвращает CallInfo для указанного имени.
 *
 * Приоритеты:
 *   1. Функция в том же модуле (direct)
 *   2. Функция в другом модуле (import)
 *   3. Не найдена (unknown)
 */
function resolveCallInfo(
  callName: string,
  callerFunc: any,
  callerFilePath: string,
  entitiesMap: Record<string, EntitiesResult>,
  funcIndex: Record<string, FunctionIndexEntry>
): CallInfo {
  // 1. Прямой поиск в индексе функций
  const target = funcIndex[callName];

  if (target) {
    // Определяем тип вызова: direct (та же файловая система) или import
    const isSameFile = target.file === callerFilePath;

    return {
      targetId: target.id,
      targetName: callName,
      targetFile: target.file,
      targetLine: target.line,
      targetVscode: target.vscode,
      callLine: callerFunc.line || 0,
      callType: isSameFile ? 'direct' : 'import',
    };
  }

  // 2. Поиск по другим модулям
  for (const [otherFile, otherEntities] of Object.entries(entitiesMap)) {
    if (otherFile === callerFilePath) continue;

    const foundFunc = (otherEntities.functions || []).find((f: any) => f.name === callName);

    if (foundFunc) {
      const targetId = resolveFunctionId(foundFunc, otherFile);
      return {
        targetId,
        targetName: callName,
        targetFile: otherFile,
        targetLine: foundFunc.line || 0,
        targetVscode: `vscode://file/${otherFile}:${foundFunc.line}`,
        callLine: callerFunc.line || 0,
        callType: 'import',
      };
    }
  }

  // 3. Не найдена — заглушка
  return {
    targetId: 'unknown',
    targetName: callName,
    targetFile: 'unknown',
    targetLine: 0,
    targetVscode: '',
    callLine: callerFunc.line || 0,
    callType: 'direct',
  };
}

// ============================================================
// ШАГ 3: КАРТА CALLEDBY
// ============================================================

/**
 * Строит карту calledBy на основе карты calls:
 *   calledBy[targetId] = [CalledByInfo, CalledByInfo, ...]
 *
 * Для каждой связи calls[callerId] → CallInfo.targetId
 * добавляет обратную ссылку в calledBy[CallInfo.targetId].
 *
 * Связи с targetId === 'unknown' игнорируются.
 */
function buildCalledByMap(
  entitiesMap: Record<string, EntitiesResult>,
  callsMap: Record<string, CallInfo[]>,
  calledByMap: Record<string, CalledByInfo[]>
): void {
  // Инициализируем calledBy для всех функций
  for (const [filePath, entities] of Object.entries(entitiesMap)) {
    for (const func of entities.functions || []) {
      const id = resolveFunctionId(func, filePath);
      calledByMap[id] = [];
    }
  }

  // Проходим по всем calls и добавляем обратные ссылки
  for (const [callerId, calls] of Object.entries(callsMap)) {
    for (const call of calls) {
      const targetId = call.targetId;

      if (!targetId || targetId === 'unknown') continue;
      if (!calledByMap[targetId]) continue;

      // Находим информацию о вызывающей функции
      const callerInfo = findCallerInfo(callerId, entitiesMap);

      if (!callerInfo) continue;

      // Проверяем, не добавлена ли уже такая связь
      const alreadyExists = calledByMap[targetId].some(
        c => c.callerId === callerId && c.callLine === call.callLine
      );

      if (alreadyExists) continue;

      calledByMap[targetId].push({
        callerId: callerInfo.id,
        callerName: callerInfo.name,
        callerFile: callerInfo.file,
        callerLine: callerInfo.line,
        callerVscode: callerInfo.vscode,
        callLine: call.callLine,
        callType: call.callType as CalledByInfo['callType'],
      });
    }
  }
}

/**
 * Находит информацию о вызывающей функции по её ID.
 *
 * Перебирает все модули и все функции, пока не найдёт
 * функцию с указанным ID. Возвращает null, если не найдена.
 */
function findCallerInfo(
  callerId: string,
  entitiesMap: Record<string, EntitiesResult>
): {
  id: string;
  name: string;
  file: string;
  line: number;
  vscode: string;
} | null {
  for (const [filePath, entities] of Object.entries(entitiesMap)) {
    const func = (entities.functions || []).find((f: any) => {
      const fId = resolveFunctionId(f, filePath);
      return fId === callerId;
    });

    if (func) {
      return {
        id: callerId,
        name: func.name,
        file: filePath,
        line: func.line || 0,
        vscode: `vscode://file/${filePath}:${func.line}`,
      };
    }
  }

  return null;
}

// ============================================================
// ШАГ 4: КАРТА IMPORTEDBY
// ============================================================

/**
 * Строит карту importedBy:
 *   importedBy[targetFunctionId] = [ImportedByInfo, ImportedByInfo, ...]
 *
 * Делегирует работу функции `collectImporters` из соседнего модуля
 * `importers/importers-collector.ts` — она уже умеет:
 *   - резолвить пути импортов
 *   - искать целевую функцию по имени
 *   - обрабатывать namespace/default/named-импорты
 */
function buildImportedByMap(
  entitiesMap: Record<string, EntitiesResult>,
  graph: Record<string, string[]>,
  importedByMap: Record<string, ImportedByInfo[]>
): void {
  const collected = collectImporters(entitiesMap, graph);

  for (const [targetId, importers] of Object.entries(collected)) {
    importedByMap[targetId] = importers;
  }
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default buildOptimizedRelationships;
