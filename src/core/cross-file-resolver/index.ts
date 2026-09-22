// src/core/cross-file-resolver/index.ts
// ============================================================
// ОРКЕСТРАТОР CROSS-FILE RESOLVER (P3)
// ============================================================
// Версия: 1.1.1
//
// ИЗМЕНЕНИЯ v1.1.1 (fix TS2339 в safeCalleeText):
//   - ✅ ИСПРАВЛЕНО: `Property 'getExpression' does not exist on type 'Node'`.
//     Метод `getExpression()` есть только у CallExpression и
//     NewExpression, но не у базового Node. Теперь используется
//     type guard `Node.isCallExpression` / `Node.isNewExpression`.
//   - ✅ ДОБАВЛЕНО: для неподдерживаемых типов (TaggedTemplateExpression
//     и др.) возвращаем '<unsupported>' вместо исключения.
//   - ✅ УТОЧНЕНО: JSDoc на русском, добавлено объяснение
//     «почему не node.getExpression()».
//
// ИЗМЕНЕНИЯ v1.1.0 (диагностика unresolved + улучшенная типизация):
//   - ✅ ДОБАВЛЕНО: сбор причин unresolved-вызовов в массив
//     `unresolvedReasons`. В verbose-режиме выводится ТОП-20
//     причин — это позволяет диагностировать, почему в реальных
//     проектах unresolved rate доходит до 78%.
//   - ✅ ДОБАВЛЕНО: поле `reason` в CrossFileCallRecord —
//     'symbol_not_found' | 'no_enclosing_function' | 'no_target_line'
//     | 'no_target_file' | 'no_target_file_id'.
//   - ✅ ДОБАВЛЕНО: агрегация причин unresolved в stats.unresolvedByReason.
//   - ✅ ДОБАВЛЕНО: экспорт типа `UnresolvedReason` для внешних
//     потребителей (например, для отдельного CLI-отчёта).
//   - ✅ ИСПРАВЛЕНО: импорт `path` (используется в диагностике
//     для `path.basename(file)`).
//   - ✅ УТОЧНЕНО: docstring на русском, добавлены примеры.
//
// ИЗМЕНЕНИЯ v1.0.1 (fix TS errors):
//   - ✅ ИСПРАВЛЕНО: убран параметр `entitiesMap` из processSourceFile
//     (TS6133: 'entitiesMap' is declared but its value is never read).
//   - ✅ ИСПРАВЛЕНО: `cache.get()` → корректная типизация с cached
//     (TS2345: Argument of type 'ResolvedCallee | null | undefined'
//      is not assignable to parameter of type 'ResolvedCallee | null').
//   - ✅ ИСПРАВЛЕНО: импорт SymbolResolver / ProjectManager / ResolveCache
//     — использовать прямой импорт и реэкспорт из их файлов.
//
// ИЗМЕНЕНИЯ v1.0.0:
//   - Первая версия.
//
// НАЗНАЧЕНИЕ
// ----------
// Единая точка входа для резолвинга межфайловых вызовов.
//
// АЛГОРИТМ
// --------
//   1. Создать ProjectManager, добавить файлы
//   2. Создать SymbolResolver, ResolveCache
//   3. Для каждого SourceFile:
//      a. Пройти по всем CallExpression/NewExpression
//      b. Резолвить callee через SymbolResolver
//      c. Найти enclosing function (from)
//      d. Найти target function (to) по filePath+line
//      e. Если нашлось — добавить в calls[]
//      f. Если нет — увеличить unresolvedCalls и записать причину
//   4. Вернуть CrossFileCall[] + stats
//
// ВАЖНО
// -----
//   - Для .vue использовать VueLineMapping (смещение line)
//   - Для вызывающей функции использовать entitiesMap.functions
//   - Для вызываемой функции использовать lineToFuncId
// ============================================================

import path from 'path';
import { Node, type SourceFile } from 'ts-morph';

import type { EntitiesResult } from '../../types.js';
import type {
  CrossFileCall,
  CrossFileResolverOptions,
  ResolveStats,
  ResolvedCallee,
  UnresolvedReason,
} from './types.js';

import { ProjectManager } from './project-manager.js';
import { SymbolResolver } from './symbol-resolver.js';
import { ResolveCache } from './cache.js';

// ============================================================
// ГЛАВНАЯ ФУНКЦИЯ
// ============================================================

/**
 * Резолвит межфайловые вызовы для всех файлов в entitiesMap.
 *
 * ════════════════════════════════════════════════════════════
 * ИСПОЛЬЗОВАНИЕ
 * ════════════════════════════════════════════════════════════
 *
 *   const { calls, stats } = await resolveCrossFileCalls(
 *     entitiesMap,
 *     { projectRoot: './src', verbose: true }
 *   );
 *
 * ════════════════════════════════════════════════════════════
 * ВОЗВРАЩАЕМОЕ ЗНАЧЕНИЕ
 * ════════════════════════════════════════════════════════════
 *
 *   {
 *     calls: CrossFileCall[],
 *     stats: ResolveStats,
 *   }
 *
 * ════════════════════════════════════════════════════════════
 * ПРИМЕЧАНИЕ ПО .vue
 * ════════════════════════════════════════════════════════════
 *
 *   Для .vue-файлов создаётся виртуальный SourceFile
 *   (`${vuePath}.__script__.ts`). Позиция вызова в виртуальном
 *   файле конвертируется в позицию оригинала через `lineOffset`
 *   из `VueLineMapping`.
 *
 * @param entitiesMap — карта { filePath → EntitiesResult }
 * @param options     — опции
 * @returns { calls, stats }
 */
export async function resolveCrossFileCalls(
  entitiesMap: Record<string, EntitiesResult>,
  options: CrossFileResolverOptions
): Promise<{ calls: CrossFileCall[]; stats: ResolveStats }> {
  const startTime = Date.now();

  // ============================================================
  // Шаг 0: Подготовка
  // ============================================================
  const filePaths = Object.keys(entitiesMap);
  const totalFiles = filePaths.length;

  if (totalFiles === 0) {
    return {
      calls: [],
      stats: makeEmptyStats(),
    };
  }

  // ============================================================
  // Шаг 1: Инициализация Project
  // ============================================================
  const initStart = Date.now();
  const pm = new ProjectManager(options);

  try {
    await pm.initialize(filePaths);
  } catch (err) {
    if (options.verbose) {
      console.error(`[P3] Ошибка инициализации Project: ${errMsg(err)}`);
    }
    return {
      calls: [],
      stats: {
        ...makeEmptyStats(),
        initDurationMs: Date.now() - initStart,
        durationMs: Date.now() - startTime,
      },
    };
  }

  const initDuration = Date.now() - initStart;

  if (options.verbose) {
    console.log(`[P3] Project инициализирован за ${initDuration}ms`);
  }

  // ============================================================
  // Шаг 2: Подготовка индексов
  // ============================================================
  // 2.1. filePath → fileId (f1, f2, ...)
  const filePathToFileId = new Map<string, string>();
  let fileCounter = 0;
  for (const fp of filePaths) {
    fileCounter++;
    filePathToFileId.set(fp, `f${fileCounter}`);
  }

  // 2.2. filePath → (line → funcId)
  const lineToFuncId = new Map<string, Map<number, string>>();
  for (const [fp, entities] of Object.entries(entitiesMap)) {
    const lineMap = new Map<number, string>();
    for (const fn of entities.functions || []) {
      if (fn.line != null && fn.id) {
        lineMap.set(fn.line, fn.id);
      }
      // Также регистрируем по startLine (на случай, если line — 0)
      if (fn.startLine != null && fn.id && fn.startLine !== fn.line) {
        if (!lineMap.has(fn.startLine)) {
          lineMap.set(fn.startLine, fn.id);
        }
      }
    }
    lineToFuncId.set(fp, lineMap);
  }

  // ============================================================
  // Шаг 3: Резолвинг
  // ============================================================
  const resolveStart = Date.now();
  const resolver = new SymbolResolver(pm.getProject());
  const cache = new ResolveCache();
  const calls: CrossFileCall[] = [];

  // ✅ v1.1.0: диагностика unresolved
  const unresolvedReasons: Array<{
    file: string;
    line: number;
    callee: string;
    reason: UnresolvedReason;
  }> = [];

  let totalCalls = 0;
  let sameFileCalls = 0;
  let crossFileCalls = 0;
  let unresolvedCalls = 0;

  const sourceFiles = pm.getProject().getSourceFiles();
  const totalSourceFiles = sourceFiles.length;

  let processedFiles = 0;

  for (const sourceFile of sourceFiles) {
    processedFiles++;
    if (options.onProgress && processedFiles % 100 === 0) {
      options.onProgress(processedFiles, totalSourceFiles);
    }

    try {
      const result = processSourceFile(
        sourceFile,
        pm,
        resolver,
        cache,
        filePathToFileId,
        lineToFuncId,
        options.verbose === true,
        unresolvedReasons
      );

      totalCalls += result.totalCalls;
      sameFileCalls += result.sameFileCalls;
      crossFileCalls += result.crossFileCalls;
      unresolvedCalls += result.unresolvedCalls;
      calls.push(...result.calls);
    } catch (err) {
      if (options.verbose) {
        console.warn(`[P3] Ошибка обработки ${sourceFile.getFilePath()}: ${errMsg(err)}`);
      }
    }
  }

  const resolveDuration = Date.now() - resolveStart;

  // ============================================================
  // Шаг 3.5: Диагностика unresolved (v1.1.0)
  // ============================================================
  // ✅ v1.1.0: агрегация по причинам
  const unresolvedByReason: Partial<Record<UnresolvedReason, number>> = {};
  for (const r of unresolvedReasons) {
    unresolvedByReason[r.reason] = (unresolvedByReason[r.reason] ?? 0) + 1;
  }

  if (options.verbose && unresolvedReasons.length > 0) {
    console.log('');
    console.log(`🔍 Топ-20 unresolved (всего ${unresolvedReasons.length}):`);
    console.log('   Причины:');
    for (const [reason, count] of Object.entries(unresolvedByReason)) {
      const percent = ((count / unresolvedReasons.length) * 100).toFixed(1);
      console.log(`      • ${reason}: ${count} (${percent}%)`);
    }
    console.log('   Примеры:');
    for (const r of unresolvedReasons.slice(0, 20)) {
      console.log(`      ${path.basename(r.file)}:${r.line} → ${r.callee} [${r.reason}]`);
    }
  }

  // ============================================================
  // Шаг 4: Финальная статистика
  // ============================================================
  const pmStats = pm.getStats();
  const cacheStats = cache.getStats();

  pm.dispose();

  return {
    calls,
    stats: {
      totalCalls,
      sameFileCalls,
      crossFileCalls,
      unresolvedCalls,
      unresolvedByReason,
      cacheHits: cacheStats.hits,
      cacheMisses: cacheStats.misses,
      durationMs: Date.now() - startTime,
      initDurationMs: initDuration,
      resolveDurationMs: resolveDuration,
      filesAdded: pmStats.filesAdded,
      vueFilesAdded: pmStats.vueFilesAdded,
      addFileErrors: pmStats.addFileErrors,
    },
  };
}

// ============================================================
// ОБРАБОТКА ОДНОГО SOURCE FILE
// ============================================================

interface FileProcessingResult {
  calls: CrossFileCall[];
  totalCalls: number;
  sameFileCalls: number;
  crossFileCalls: number;
  unresolvedCalls: number;
}

/**
 * Обрабатывает один SourceFile.
 *
 * ⚠️ v1.0.1: параметр `entitiesMap` УДАЛЁН — не использовался.
 *   Все нужные данные уже в `filePathToFileId` и `lineToFuncId`.
 *
 * ✅ v1.1.0: добавлен параметр `verbose` для сбора диагностики
 *   и массив `unresolvedReasons` (мутируется).
 */
function processSourceFile(
  sourceFile: SourceFile,
  pm: ProjectManager,
  resolver: SymbolResolver,
  cache: ResolveCache,
  filePathToFileId: Map<string, string>,
  lineToFuncId: Map<string, Map<number, string>>,
  verbose: boolean,
  unresolvedReasons: Array<{
    file: string;
    line: number;
    callee: string;
    reason: UnresolvedReason;
  }>
): FileProcessingResult {
  const result: FileProcessingResult = {
    calls: [],
    totalCalls: 0,
    sameFileCalls: 0,
    crossFileCalls: 0,
    unresolvedCalls: 0,
  };

  const sfPath = sourceFile.getFilePath();

  // Определяем оригинальный путь и offset
  const vueMapping = pm.getVueMapping(sfPath);
  const originalPath = vueMapping?.originalPath ?? sfPath;
  const lineOffset = vueMapping?.offset ?? 0;

  const fromFileId = filePathToFileId.get(originalPath);
  if (!fromFileId) {
    // Файл не входит в entitiesMap — пропускаем
    return result;
  }

  const lineMap = lineToFuncId.get(originalPath);

  // Обходим все CallExpression и NewExpression
  sourceFile.forEachDescendant(node => {
    if (!Node.isCallExpression(node) && !Node.isNewExpression(node)) return;

    result.totalCalls++;

    // Позиция вызова (в виртуальном файле)
    const virtualPos = sourceFile.getLineAndColumnAtPos(node.getStart());
    // Реальная позиция в оригинальном файле (со смещением)
    const realLine = virtualPos.line + lineOffset;
    const realColumn = virtualPos.column;

    // Кэш по ключу
    // ✅ v1.0.1-fix: корректная типизация
    //   cache.get() возвращает `ResolvedCallee | null | undefined`:
    //     - undefined — нет в кэше
    //     - null      — резолвинг не удался (кэшировано)
    //     - ResolvedCallee — успешный резолвинг
    const cacheKey = ResolveCache.makeKey(sfPath, virtualPos.line, virtualPos.column);
    const cached = cache.get(cacheKey);

    let resolved: ResolvedCallee | null;
    if (cached === undefined) {
      // Нет в кэше — резолвим
      resolved = resolver.resolveCallee(node);
      cache.set(cacheKey, resolved);
    } else {
      // Есть в кэше (может быть null)
      resolved = cached;
    }

    // ✅ v1.1.0: диагностика — собираем calleeText один раз
    const calleeText = safeCalleeText(node);

    if (!resolved) {
      result.unresolvedCalls++;
      if (verbose) {
        unresolvedReasons.push({
          file: originalPath,
          line: realLine,
          callee: calleeText,
          reason: 'symbol_not_found',
        });
      }
      return;
    }

    // fromFunctionId — enclosing function
    const fromFunctionId = findEnclosingFunctionId(node, sourceFile, lineMap, lineOffset);

    if (!fromFunctionId) {
      result.unresolvedCalls++;
      if (verbose) {
        unresolvedReasons.push({
          file: originalPath,
          line: realLine,
          callee: calleeText,
          reason: 'no_enclosing_function',
        });
      }
      return;
    }

    // toFunctionId — по filePath + line
    const targetLineMap = lineToFuncId.get(resolved.filePath);
    if (!targetLineMap) {
      result.unresolvedCalls++;
      if (verbose) {
        unresolvedReasons.push({
          file: originalPath,
          line: realLine,
          callee: calleeText,
          reason: 'no_target_file',
        });
      }
      return;
    }

    const toFunctionId = targetLineMap.get(resolved.line);
    if (!toFunctionId) {
      result.unresolvedCalls++;
      if (verbose) {
        unresolvedReasons.push({
          file: originalPath,
          line: realLine,
          callee: calleeText,
          reason: 'no_target_line',
        });
      }
      return;
    }

    // Определяем, межфайловый ли вызов
    const targetFileId = filePathToFileId.get(resolved.filePath);
    if (!targetFileId) {
      result.unresolvedCalls++;
      if (verbose) {
        unresolvedReasons.push({
          file: originalPath,
          line: realLine,
          callee: calleeText,
          reason: 'no_target_file_id',
        });
      }
      return;
    }

    const isCrossFile = targetFileId !== fromFileId;

    if (isCrossFile) {
      result.crossFileCalls++;
    } else {
      result.sameFileCalls++;
    }

    result.calls.push({
      fromFunctionId,
      toFunctionId,
      line: realLine,
      column: realColumn,
      callKind: mapCallKind(resolved.kind),
      calleeName: resolved.name,
      isCrossFile,
      targetFileId,
    });
  });

  return result;
}

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

/**
 * Находит ID функции, внутри которой находится узел.
 *
 * Алгоритм:
 *   1. Поднимаемся от node вверх по родителям.
 *   2. Ищем FunctionDeclaration / FunctionExpression / ArrowFunction /
 *      MethodDeclaration.
 *   3. Вычисляем реальную строку (с учётом lineOffset для .vue).
 *   4. Ищем в lineMap по этой строке.
 *   5. Если не нашли — fallback: ±2 строки.
 */
function findEnclosingFunctionId(
  node: Node,
  sourceFile: SourceFile,
  lineMap: Map<number, string> | undefined,
  lineOffset: number
): string | null {
  if (!lineMap) return null;

  let current: Node | undefined = node.getParent();
  let depth = 0;

  while (current && depth < 100) {
    if (
      Node.isFunctionDeclaration(current) ||
      Node.isFunctionExpression(current) ||
      Node.isArrowFunction(current) ||
      Node.isMethodDeclaration(current)
    ) {
      const start = current.getStart();
      const pos = sourceFile.getLineAndColumnAtPos(start);
      const realLine = pos.line + lineOffset;

      // Ищем функцию в lineMap по реальной строке
      const funcId = lineMap.get(realLine);
      if (funcId) return funcId;

      // Fallback: ищем в диапазоне ±2 строк
      for (let delta = 1; delta <= 2; delta++) {
        const id1 = lineMap.get(realLine - delta);
        if (id1) return id1;
        const id2 = lineMap.get(realLine + delta);
        if (id2) return id2;
      }
    }
    current = current.getParent();
    depth++;
  }

  return null;
}

/**
 * Маппит kind из ResolvedCallee в CallKind.
 */
function mapCallKind(kind: ResolvedCallee['kind']): CrossFileCall['callKind'] {
  switch (kind) {
    case 'function':
      return 'direct';
    case 'method':
      return 'method';
    case 'constructor':
      return 'constructor';
    case 'arrow':
      return 'direct';
    default:
      return 'direct';
  }
}

/**
 * ✅ v1.1.1: безопасно извлекает текст callee для диагностики.
 *
 * ════════════════════════════════════════════════════════════
 * ПОЧЕМУ НЕ `node.getExpression()`
 * ════════════════════════════════════════════════════════════
 *
 *   Базовый тип `Node` из ts-morph НЕ имеет метода `getExpression()`.
 *   Этот метод есть только у конкретных подтипов:
 *     - CallExpression.getExpression()
 *     - NewExpression.getExpression()
 *     - TaggedTemplateExpression.getTag()
 *
 *   Поэтому используем type guards:
 *     - Node.isCallExpression(node)
 *     - Node.isNewExpression(node)
 *
 *   Это одновременно:
 *     1. Убирает ошибку TS2339.
 *     2. Делает код корректным в runtime.
 *     3. Позволяет TypeScript вывести правильный тип
 *        (CallExpression | NewExpression).
 *
 * ════════════════════════════════════════════════════════════
 * FALLBACK
 * ════════════════════════════════════════════════════════════
 *
 *   Если узел — не CallExpression и не NewExpression (например,
 *   TaggedTemplateExpression), возвращаем '<unsupported>'.
 *   Это означает, что диагностика для этого типа вызова
 *   не поддерживается, но не ломает основной flow.
 *
 * ════════════════════════════════════════════════════════════
 * ОБРЕЗКА
 * ════════════════════════════════════════════════════════════
 *
 *   Текст обрезается до 60 символов, чтобы не засорять вывод
 *   диагностики длинными выражениями вида:
 *     `someObject.someProperty.someMethod().anotherMethod()`.
 */
function safeCalleeText(node: Node): string {
  try {
    let text: string | undefined;

    if (Node.isCallExpression(node)) {
      text = node.getExpression().getText();
    } else if (Node.isNewExpression(node)) {
      text = node.getExpression().getText();
    } else {
      // TaggedTemplateExpression или иной тип —
      // диагностика не поддерживается, но не падаем.
      return '<unsupported>';
    }

    if (!text) return '<unknown>';
    return text.length > 60 ? text.slice(0, 57) + '...' : text;
  } catch {
    return '<unknown>';
  }
}

/**
 * Пустая статистика.
 */
function makeEmptyStats(): ResolveStats {
  return {
    totalCalls: 0,
    sameFileCalls: 0,
    crossFileCalls: 0,
    unresolvedCalls: 0,
    cacheHits: 0,
    cacheMisses: 0,
    durationMs: 0,
    initDurationMs: 0,
    resolveDurationMs: 0,
    filesAdded: 0,
    vueFilesAdded: 0,
    addFileErrors: 0,
  };
}

/**
 * Форматирует ошибку.
 */
function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// ============================================================
// РЕЭКСПОРТЫ
// ============================================================

export { ProjectManager } from './project-manager.js';
export { SymbolResolver } from './symbol-resolver.js';
export { ResolveCache } from './cache.js';

export type {
  CrossFileCall,
  CrossFileResolverOptions,
  ResolveStats,
  ResolvedCallee,
  VueLineMapping,
  FileResolutionResult,
  UnresolvedReason,
} from './types.js';
