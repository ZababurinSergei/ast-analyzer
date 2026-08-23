// src/reporters/compressReport.ts
import type { EnhancedPackageLockReport } from './modules/types';

export type CompressionLevel = 1 | 2 | 3 | 4 | 5;

export interface CompressionOptions {
  level?: CompressionLevel;
  includeBody?: boolean;
  includeSourceCode?: boolean;
  includeSecurity?: boolean;
  includeVSCodeLinks?: boolean;
}

export interface CompressedReport {
  v: string;
  level: CompressionLevel;
  root: number;
  time: string;
  modules: string[];
  pkg: Record<number, any>;
  funcs: any[];
  mgraph: Record<number, number[]>;
  fgraph: Record<number, number[]>;
  levels: Record<number, number[]>;
  stats: {
    funcs: number;
    mods: number;
    calls: number;
    size: number;
    depth: number;
    cycles: boolean;
  };
  // Уровень 4-5: детальные связи внутри функций
  callDetails?: Record<
    number,
    {
      calls: { to: number; line: number; isAsync: boolean }[];
      calledBy: { from: number; line: number }[];
    }
  >;
  // Уровень 5: полная структура вызовов с контекстом
  callContext?: Record<
    number,
    {
      params: string[];
      returnType: string;
      isExported: boolean;
      isAsync: boolean;
      line: number;
      endLine: number;
      calls: {
        to: number;
        line: number;
        column: number;
        isAsync: boolean;
        isMethod: boolean;
        className?: string;
      }[];
      calledBy: {
        from: number;
        line: number;
        column: number;
      }[];
      dependencies: number[];
    }
  >;
}

/**
 * Сжимает отчет с выбором уровня сжатия
 *
 * Уровни сжатия:
 * 1 - Минимальное (сохраняет почти всё, кроме body и sourceCode) - ПО УМОЛЧАНИЮ
 * 2 - Среднее (сокращает ключи, удаляет displayPath, _safeInfo)
 * 3 - Сильное (индексы для функций, удаляет signature)
 * 4 - Очень сильное (индексы для вызовов, минимальные метаданные)
 * 5 - Максимальное (полная индексация, но сохраняет ВСЕ связи между функциями)
 */
export function compressReport(
  report: EnhancedPackageLockReport,
  options: CompressionOptions = {}
): CompressedReport {
  // ✅ ПО УМОЛЧАНИЮ УРОВЕНЬ 1 - САМЫЙ СЛАБЫЙ, СОХРАНЯЕТ МАКСИМУМ
  const level = options.level || 1;
  const includeBody = options.includeBody !== undefined ? options.includeBody : true;
  const includeSourceCode =
    options.includeSourceCode !== undefined ? options.includeSourceCode : true;
  const includeSecurity = options.includeSecurity !== undefined ? options.includeSecurity : true;
  const includeVSCodeLinks =
    options.includeVSCodeLinks !== undefined ? options.includeVSCodeLinks : true;

  // 1. Строим список модулей и индекс
  const modulePaths = Object.keys(report.packages || {});
  const modIdx = new Map(modulePaths.map((p, i) => [p, i]));

  // 2. Строим список функций и индекс (учитываем модуль!)
  const functions: any[] = [];
  const funcIdx = new Map<string, number>();
  const funcDetails: Record<number, any> = {};

  for (const [modPath, pkg] of Object.entries(report.packages || {})) {
    const mi = modIdx.get(modPath)!;
    const entities = pkg?.entities;
    const funcs = entities?.functions || [];

    for (const func of funcs) {
      const key = `${modPath}#${func.name}`;
      const idx = functions.length;
      funcIdx.set(key, idx);

      // Базовые данные (все уровни)
      const baseFunc: any = {
        n: func.name,
        m: mi,
        l: func.line || 0,
      };

      // ✅ УРОВЕНЬ 1: сохраняем максимум метаданных
      if (level === 1) {
        baseFunc.e = func.isExported || false;
        baseFunc.a = func.isAsync || false;
        baseFunc.p = func.params || [];
        baseFunc.r = func.returnType || 'any';
        baseFunc.c = [];
        baseFunc.sl = func.startLine || func.line || 0;
        baseFunc.el = func.endLine || func.line || 0;
        baseFunc.mtd = func.isMethod || false;
        baseFunc.cls = func.className || '';
        baseFunc.nstd = func.isNested || false;
        baseFunc.prnt = func.parentFunction || '';
        baseFunc.arr = func.isArrow || false;
        baseFunc.evt = func.isEventHandler || false;
        baseFunc.evtType = func.eventType || '';
        baseFunc.dpth = func.depth || 0;
        baseFunc.cmplx = func.complexity || 1;

        // Сохраняем тело функции (если включено)
        if (includeBody && func.body) {
          baseFunc.b = func.body;
        }
        // Сохраняем сигнатуру
        if (func.signature) {
          baseFunc.sig = func.signature;
        }
        // Сохраняем ссылку VS Code
        if (includeVSCodeLinks && func.vscode) {
          baseFunc.vs = func.vscode;
        }
        // Сохраняем информацию о безопасности
        if (includeSecurity && func.security) {
          baseFunc.sec = func.security;
        }
      }

      // Уровень 2: сохраняем основные метаданные
      if (level === 2) {
        baseFunc.e = func.isExported || false;
        baseFunc.a = func.isAsync || false;
        baseFunc.p = func.params || [];
        baseFunc.r = func.returnType || 'any';
        baseFunc.c = [];
        baseFunc.sl = func.startLine || func.line || 0;
        baseFunc.el = func.endLine || func.line || 0;
        if (includeVSCodeLinks && func.vscode) {
          baseFunc.vs = func.vscode;
        }
      }

      // Уровень 3: минимальные данные
      if (level === 3) {
        baseFunc.e = func.isExported || false;
        baseFunc.a = func.isAsync || false;
        baseFunc.p = func.params || [];
        baseFunc.r = func.returnType || 'any';
        baseFunc.c = [];
      }

      // Уровень 4+: только имя, модуль и линия
      if (level >= 4) {
        baseFunc.c = [];
      }

      functions.push(baseFunc);

      // Детали для уровней 4-5
      if (level >= 4) {
        funcDetails[idx] = {
          params: func.params || [],
          returnType: func.returnType || 'any',
          isExported: func.isExported || false,
          isAsync: func.isAsync || false,
          line: func.line || 0,
          endLine: func.endLine || func.line || 0,
          calls: [],
          calledBy: [],
          dependencies: [],
        };
      }
    }
  }

  // 3. Заполняем вызовы (c) для каждой функции
  for (const [modPath, pkg] of Object.entries(report.packages || {})) {
    const entities = pkg?.entities;
    const funcs = entities?.functions || [];

    for (const func of funcs) {
      const key = `${modPath}#${func.name}`;
      const idx = funcIdx.get(key);
      if (idx === undefined) continue;

      // Собираем все вызовы с информацией о линиях
      const callsWithInfo = (func.calls || [])
        .map(call => {
          // Ищем вызываемую функцию в ТОМ ЖЕ модуле сначала
          const localKey = `${modPath}#${call}`;
          if (funcIdx.has(localKey)) {
            return {
              to: funcIdx.get(localKey)!,
              name: call,
              isLocal: true,
            };
          }
          // Если не найдена в том же модуле, ищем в других
          for (const [otherModPath] of Object.entries(report.packages || {})) {
            if (otherModPath === modPath) continue;
            const otherKey = `${otherModPath}#${call}`;
            if (funcIdx.has(otherKey)) {
              return {
                to: funcIdx.get(otherKey)!,
                name: call,
                isLocal: false,
              };
            }
          }
          return undefined;
        })
        .filter(
          (item): item is { to: number; name: string; isLocal: boolean } => item !== undefined
        );

      const callIndices = callsWithInfo.map(c => c.to);

      // Уровень 1-3: простой массив вызовов
      if (level <= 3) {
        functions[idx].c = callIndices;
      }

      // Уровень 4-5: детальные вызовы с контекстом
      if (level >= 4 && funcDetails[idx]) {
        // Сохраняем детали вызовов с линиями
        const callDetailsList: any[] = [];

        // Пытаемся определить линии вызовов из тела функции
        const callLines = extractCallLinesFromBody(func.body || '', func.calls || []);

        for (const callInfo of callsWithInfo) {
          const calledFunc = functions[callInfo.to];
          if (calledFunc) {
            callDetailsList.push({
              to: callInfo.to,
              line: callLines[callInfo.name] || func.line || 0,
              column: 0,
              isAsync: calledFunc.a || false,
              isMethod: func.isMethod || false,
              className: func.className,
            });
          }
        }

        funcDetails[idx].calls = callDetailsList;
        functions[idx].c = callIndices; // сохраняем для обратной совместимости
      }
    }
  }

  // 4. Заполняем calledBy (кто вызывает функцию) для уровней 4-5
  if (level >= 4) {
    // Строим обратный индекс
    const calledByMap: Record<number, any[]> = {};
    for (const idx of Object.keys(funcDetails)) {
      const numIdx = Number(idx);
      calledByMap[numIdx] = [];
    }

    for (const [modPath, pkg] of Object.entries(report.packages || {})) {
      const entities = pkg?.entities;
      const funcs = entities?.functions || [];

      for (const func of funcs) {
        const key = `${modPath}#${func.name}`;
        const fromIdx = funcIdx.get(key);
        if (fromIdx === undefined) continue;

        const calls = (func.calls || [])
          .map(call => {
            const localKey = `${modPath}#${call}`;
            if (funcIdx.has(localKey)) return funcIdx.get(localKey)!;
            for (const [otherModPath] of Object.entries(report.packages || {})) {
              if (otherModPath === modPath) continue;
              const otherKey = `${otherModPath}#${call}`;
              if (funcIdx.has(otherKey)) return funcIdx.get(otherKey)!;
            }
            return undefined;
          })
          .filter((i): i is number => i !== undefined);

        for (const toIdx of calls) {
          if (calledByMap[toIdx]) {
            calledByMap[toIdx].push({
              from: fromIdx,
              line: func.line || 0,
              column: 0,
            });
          }
        }
      }
    }

    // Добавляем calledBy в funcDetails
    for (const idx of Object.keys(funcDetails)) {
      const numIdx = Number(idx);
      if (calledByMap[numIdx]) {
        funcDetails[numIdx].calledBy = calledByMap[numIdx];
      }
    }
  }

  // 5. Строим компактные пакеты (pkg)
  const packages: any = {};
  for (const [modPath, pkg] of Object.entries(report.packages || {})) {
    const mi = modIdx.get(modPath)!;
    const entities = pkg?.entities;
    const funcs = (entities?.functions || [])
      .map((f: any) => {
        const key = `${modPath}#${f.name}`;
        return funcIdx.get(key);
      })
      .filter((i): i is number => i !== undefined);

    const pkgData: any = {
      l: pkg?.language || 'ts',
      s: pkg?.fileStats?.size || 0,
      ln: pkg?.fileStats?.lines || 0,
      entry: pkg?.isEntry || false,
      f: funcs,
    };

    // ✅ УРОВЕНЬ 1: сохраняем максимум метаданных модуля
    if (level === 1) {
      if (pkg?.fileStats) {
        pkgData.fc = pkg.fileStats.functions || 0;
        pkgData.cl = pkg.fileStats.classes || 0;
        pkgData.cn = pkg.fileStats.constants || 0;
        pkgData.in = pkg.fileStats.interfaces || 0;
        pkgData.tp = pkg.fileStats.types || 0;
        pkgData.vr = pkg.fileStats.variables || 0;
      }
      if (pkg?.vscode) {
        pkgData.vs = pkg.vscode;
      }
      if (includeSourceCode && pkg?.sourceCode) {
        pkgData.sc = pkg.sourceCode;
      }
      if (pkg?.vueAnalysis) {
        pkgData.vue = {
          props: pkg.vueAnalysis.props?.names || [],
          emits: pkg.vueAnalysis.emits?.names || [],
          slots: pkg.vueAnalysis.slots || [],
          composables: pkg.vueAnalysis.composables || [],
          templateComplexity: pkg.vueAnalysis.templateComplexity || 0,
          scriptType: pkg.vueAnalysis.scriptType || 'options',
          isTS: pkg.vueAnalysis.isTS || false,
          stats: pkg.vueAnalysis.stats || {},
        };
      }
      if (pkg?.imports && Object.keys(pkg.imports).length > 0) {
        pkgData.imp = pkg.imports;
      }
      if (pkg?.exports && Object.keys(pkg.exports).length > 0) {
        pkgData.exp = pkg.exports;
      }
    }

    // Уровень 2: сохраняем основные метаданные
    if (level === 2) {
      if (pkg?.fileStats) {
        pkgData.fc = pkg.fileStats.functions || 0;
        pkgData.cl = pkg.fileStats.classes || 0;
        pkgData.cn = pkg.fileStats.constants || 0;
        pkgData.in = pkg.fileStats.interfaces || 0;
        pkgData.tp = pkg.fileStats.types || 0;
        pkgData.vr = pkg.fileStats.variables || 0;
      }
      if (pkg?.vscode) {
        pkgData.vs = pkg.vscode;
      }
      if (pkg?.vueAnalysis) {
        pkgData.vue = {
          pr: pkg.vueAnalysis.props?.names?.length || 0,
          em: pkg.vueAnalysis.emits?.names?.length || 0,
          sl: pkg.vueAnalysis.slots?.length || 0,
          co: pkg.vueAnalysis.composables?.length || 0,
        };
      }
    }

    // Уровень 3: минимальные метаданные
    if (level === 3) {
      if (pkg?.fileStats) {
        pkgData.fc = pkg.fileStats.functions || 0;
        pkgData.cl = pkg.fileStats.classes || 0;
      }
      if (pkg?.vscode) {
        pkgData.vs = pkg.vscode;
      }
    }

    // Уровень 4-5: только базовая информация
    if (level >= 4) {
      if (pkg?.vscode) {
        pkgData.vs = pkg.vscode;
      }
      if (pkg?.vueAnalysis) {
        pkgData.vue = {
          pr: pkg.vueAnalysis.props?.names?.length || 0,
          em: pkg.vueAnalysis.emits?.names?.length || 0,
          sl: pkg.vueAnalysis.slots?.length || 0,
          co: pkg.vueAnalysis.composables?.length || 0,
        };
      }
    }

    packages[mi] = pkgData;
  }

  // 6. Строим граф модулей (mgraph)
  const mgraph: Record<number, number[]> = {};
  for (const [fromMod, deps] of Object.entries(report.dependencyGraph?.outwardDependencies || {})) {
    const fromIdx = modIdx.get(fromMod);
    if (fromIdx === undefined) continue;
    mgraph[fromIdx] = (deps || [])
      .map(d => modIdx.get(d))
      .filter((i): i is number => i !== undefined);
  }

  // 7. Строим граф функций (fgraph) - для уровней 1-3
  const fgraph: Record<number, number[]> = {};
  for (const [, idx] of funcIdx) {
    fgraph[idx] = functions[idx]?.c || [];
  }

  // 8. Строим уровни (levels)
  const levels: Record<number, number[]> = {};
  if (report.architectureMetrics?.modulesByLevel) {
    for (const [levelNum, mods] of Object.entries(report.architectureMetrics.modulesByLevel)) {
      levels[Number(levelNum)] = mods
        .map(m => modIdx.get(m))
        .filter((i): i is number => i !== undefined);
    }
  }

  // 9. Статистика
  const stats = {
    funcs: functions.length,
    mods: modulePaths.length,
    calls: functions.reduce((sum, f) => sum + (f.c?.length || 0), 0),
    size: report.fileStats?.totalSize || 0,
    depth: report.architectureMetrics?.maxDepth || 0,
    cycles: report.architectureMetrics?.hasCycles || false,
  };

  // 10. Формируем результат в зависимости от уровня
  const result: CompressedReport = {
    v: '3.0.1',
    level: level,
    root: modIdx.get(report.summary?.entryPoint || '') || 0,
    time: report.timestamp || new Date().toISOString(),
    modules: modulePaths,
    pkg: packages,
    funcs: functions,
    mgraph,
    fgraph,
    levels,
    stats,
  };

  // Уровень 4: добавляем детальные вызовы
  if (level >= 4) {
    result.callDetails = {};
    for (const [idx, details] of Object.entries(funcDetails)) {
      const numIdx = Number(idx);
      result.callDetails[numIdx] = {
        calls: details.calls || [],
        calledBy: details.calledBy || [],
      };
    }
  }

  // Уровень 5: добавляем полный контекст вызовов
  if (level >= 5) {
    result.callContext = {};
    for (const [idx, details] of Object.entries(funcDetails)) {
      const numIdx = Number(idx);
      // Строим зависимости (уникальные вызываемые функции)
      const deps = new Set<number>();
      for (const call of details.calls || []) {
        deps.add(call.to);
      }

      result.callContext[numIdx] = {
        params: details.params || [],
        returnType: details.returnType || 'any',
        isExported: details.isExported || false,
        isAsync: details.isAsync || false,
        line: details.line || 0,
        endLine: details.endLine || details.line || 0,
        calls: details.calls || [],
        calledBy: details.calledBy || [],
        dependencies: Array.from(deps),
      };
    }

    // Уровень 5: удаляем дублирующиеся данные из funcs
    for (const func of result.funcs) {
      delete func.c;
    }
  }

  return result;
}

/**
 * Извлекает линии вызовов из тела функции
 * Используется для уровней 4-5
 */
function extractCallLinesFromBody(body: string, calls: string[]): Record<string, number> {
  const result: Record<string, number> = {};

  if (!body || !calls.length) {
    return result;
  }

  const lines = body.split('\n');

  for (const call of calls) {
    // Ищем вызов в каждой строке
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      // Ищем паттерны вызовов: call(), call (, call(, call (
      const patterns = [
        new RegExp(`\\b${call}\\s*\\(`, 'g'),
        new RegExp(`\\b${call}\\s*\\[`, 'g'),
        new RegExp(`\\b${call}\\s*\\.`, 'g'),
      ];

      for (const pattern of patterns) {
        pattern.lastIndex = 0;
        if (pattern.test(line)) {
          result[call] = i + 1;
          break;
        }
      }

      if (result[call]) break;
    }

    // Если не нашли в теле, используем приблизительную линию
    if (!result[call]) {
      // Ищем вхождение имени функции в теле
      const index = body.indexOf(call);
      if (index !== -1) {
        const lineCount = body.substring(0, index).split('\n').length;
        result[call] = lineCount + 1;
      } else {
        result[call] = 1;
      }
    }
  }

  return result;
}

/**
 * Быстрое сжатие с уровнем 1 (минимальное, максимум данных) - ПО УМОЛЧАНИЮ
 */
export function compressReportMinimal(report: EnhancedPackageLockReport): CompressedReport {
  return compressReport(report, {
    level: 1,
    includeBody: true,
    includeSourceCode: true,
    includeSecurity: true,
    includeVSCodeLinks: true,
  });
}

/**
 * Быстрое сжатие с уровнем 3 (баланс)
 */
export function compressReportBalanced(report: EnhancedPackageLockReport): CompressedReport {
  return compressReport(report, { level: 3, includeVSCodeLinks: true });
}

/**
 * Быстрое сжатие с уровнем 5 (максимальное)
 */
export function compressReportMax(report: EnhancedPackageLockReport): CompressedReport {
  return compressReport(report, { level: 5, includeVSCodeLinks: true });
}

// Экспорт по умолчанию
export default {
  compressReport,
  compressReportMinimal,
  compressReportBalanced,
  compressReportMax,
};
