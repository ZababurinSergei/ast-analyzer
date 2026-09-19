// packages/ast-analyzer/src/reporters/json/builders/enhanced-report.ts

// ============================================================
// ENHANCED REPORT BUILDER
//
// Строит EnhancedPackageLockReport (без сохранения на диск).
// Используется в cli.ts при вызове `project --entities`.
//
// Особенности:
// - Делегирует построение packages в buildPackages().
// - Дополнительно обогащает пакеты imports/reExports,
//   чтобы гарантировать корректную обработку export * from.
// - Считает все метрики: entityStats, fileStats, architectureMetrics, summary.
// ============================================================

import type {
  EntitiesResult,
  EnhancedPackageLockReport,
  EnhancedEntityInfo,
} from '../../../types.js';

import type { FunctionEntity } from '../../modules/types.js';

import { buildPackages } from '../../modules/packages.js';
import { buildDependencyGraph } from '../../modules/graphs.js';
import { buildExecutionGraph, buildImportExportFlow } from '../../modules/flows.js';
import { buildArchitectureMetrics } from '../../modules/architecture.js';
import { buildSummary } from '../../modules/summary.js';
import { calculateEntityStats, calculateFileStats } from '../../modules/statistics.js';
import { createMetadata } from '../../modules/metadata.js';
import { findProjectRoot, ensureArray } from '../../modules/utils.js';

import { convertEntitiesToEnhanced } from '../utils/entities-converter.js';

import idManager from '../../../core/IdManager.js';

// ============================================================
// ОСНОВНАЯ ФУНКЦИЯ
// ============================================================

/**
 * Строит EnhancedPackageLockReport на основе графа зависимостей
 * и карты извлечённых сущностей.
 *
 * @param rootKey        Корневой модуль (entry point)
 * @param graph          Граф зависимостей: module → [imports]
 * @param entitiesMap    Карта: modulePath → EntitiesResult
 * @param _filePaths     Зарезервировано (для будущего использования)
 * @param _options       Опции (includeBody и т.п.) — передаются в buildPackages
 */
export function buildEnhancedPackageLockReport(
  rootKey: string,
  graph: Record<string, string[]>,
  entitiesMap: Record<string, EntitiesResult>,
  _filePaths?: string[],
  _options?: { includeBody?: boolean }
): EnhancedPackageLockReport {
  // Очищаем кэш IdManager перед генерацией,
  // чтобы ID были стабильны и не пересекались с предыдущими прогонами.
  idManager.clear();

  const projectRoot = findProjectRoot(process.cwd()) || process.cwd();
  const metadata = createMetadata();

  // ============================================================
  // ШАГ 1: Конвертация EntitiesResult → EnhancedEntityInfo
  // ============================================================
  const enhancedEntitiesMap: Record<string, EnhancedEntityInfo> = {};
  for (const [modulePath, entities] of Object.entries(entitiesMap)) {
    enhancedEntitiesMap[modulePath] = convertEntitiesToEnhanced(entities);
  }

  // ============================================================
  // ШАГ 2: Построение пакетов
  //
  // buildPackages уже включает в exportsMap:
  //   - функции (isExported)
  //   - константы, переменные, классы, интерфейсы, типы
  //   - реэкспорты (при условии применения патча в packages.ts)
  //
  // Но для надёжности мы ДОПОЛНИТЕЛЬНО проверяем и добавляем
  // imports и reExports ниже — это гарантирует, что export * from
  // попадёт в итоговый отчёт независимо от поведения buildPackages.
  // ============================================================
  const packages = buildPackages(rootKey, graph, enhancedEntitiesMap, projectRoot, _options);

  // ============================================================
  // ШАГ 3: Обогащение пакетов imports и reExports
  //
  // Проходим по каждому модулю и добавляем:
  //   - pkg.imports  — из entities.imports
  //   - pkg.exports  — реэкспорты из entities.exports (isReExport)
  //
  // Это критично для команды `project --entities`, которая
  // использует именно этот builder.
  // ============================================================
  for (const [modulePath, pkg] of Object.entries(packages)) {
    const entities = entitiesMap[modulePath];
    if (!entities) continue;

    // ------------------------------------------------------------
    // 3.1. Импорты
    // ------------------------------------------------------------
    if (entities.imports && entities.imports.length > 0) {
      pkg.imports = {};

      for (const imp of entities.imports) {
        const specifiers = (imp.specifiers || []).map(s =>
          typeof s === 'string' ? s : s.imported || s.local || ''
        );

        pkg.imports[imp.source] = {
          direction: 'inward',
          type: 'import',
          specifiers,
          functions: {},
        };
      }
    }

    // ------------------------------------------------------------
    // 3.2. Реэкспорты (export * from, export { x } from)
    //
    // Ключ формируется как:
    //   - `*:${source}` для star-реэкспортов (export * from './foo')
    //   - `${name}` для именованных (export { x } from './foo')
    //
    // Это позволяет хранить несколько реэкспортов из разных источников
    // в одном модуле без коллизий.
    // ------------------------------------------------------------
    if (entities.exports && entities.exports.length > 0) {
      const reExports = entities.exports.filter((exp: any) => exp && exp.isReExport);

      if (reExports.length > 0) {
        // Убеждаемся, что pkg.exports существует
        if (!pkg.exports) {
          pkg.exports = {};
        }

        for (const exp of reExports) {
          const expAny = exp as any;

          const exportKey = expAny.isStarReExport ? `*:${expAny.source}` : exp.name || '*';

          pkg.exports[exportKey] = {
            direction: 'outward',
            type: 're-export',
            line: expAny.startLine || 0,
            consumers: [],

            // Информация о реэкспорте
            exportName: exp.name || '*',
            localName: exp.name || '*',
            source: expAny.source,
            isTypeOnly: expAny.isTypeOnly || false,
            isReExport: true,
            isStarReExport: expAny.isStarReExport === true,
            isDefaultReExport: false,
          };
        }
      }
    }
  }

  // ============================================================
  // ШАГ 4: Граф зависимостей
  // ============================================================
  const dependencyGraph = buildDependencyGraph(graph);

  // ============================================================
  // ШАГ 5: Граф выполнения
  // ============================================================
  const executionGraph = buildExecutionGraph(rootKey, entitiesMap, { rootKey, graph }, packages);

  // ============================================================
  // ШАГ 6: Import/Export Flow
  //
  // Функция buildImportExportFlow возвращает структуры с массивами,
  // которые могут содержать undefined-элементы. Мы фильтруем их
  // и приводим к корректным типам, чтобы JSON.stringify не падал.
  // ============================================================
  const rawImportExportFlow = buildImportExportFlow(
    graph,
    entitiesMap,
    { rootKey, graph },
    packages
  );

  const safeImportExportFlow = {
    imports: Object.fromEntries(
      Object.entries(rawImportExportFlow.imports || {}).map(([key, value]) => [
        key,
        {
          importsFrom: (value?.importsFrom || []).map((item: any) => ({
            module: item.module || '',
            type: (item.type || 'named') as 'named' | 'default' | 'namespace',
            imports: (item.imports || []).filter(
              (s: string | undefined): s is string => s !== undefined && s !== null && s !== ''
            ),
          })),
        },
      ])
    ),
    exports: Object.fromEntries(
      Object.entries(rawImportExportFlow.exports || {}).map(([key, value]) => [
        key,
        {
          exportsTo: (value?.exportsTo || []).map((item: any) => ({
            module: item.module || '',
            type: (item.type || 'named') as 'named' | 'default',
            exports: (item.exports || []).filter(
              (s: string | undefined): s is string => s !== undefined && s !== null && s !== ''
            ),
          })),
        },
      ])
    ),
  };

  // ============================================================
  // ШАГ 7: Call Graph (плоский словарь)
  // ============================================================
  const callGraph: Record<string, string[]> = {};

  for (const entities of Object.values(entitiesMap)) {
    if (!entities) continue;

    const functions = ensureArray(entities.functions) as FunctionEntity[];

    for (const func of functions) {
      const key = func.isMethod && func.className ? `${func.className}.${func.name}` : func.name;

      if (!callGraph[key]) {
        callGraph[key] = [];
      }

      callGraph[key] = func.calls || [];
    }
  }

  // ============================================================
  // ШАГ 8: Статистика
  // ============================================================
  const entityStats = calculateEntityStats(packages, callGraph);
  const fileStats = calculateFileStats(packages);

  // ============================================================
  // ШАГ 9: Архитектурные метрики
  // ============================================================
  const architectureMetrics = buildArchitectureMetrics(
    packages,
    callGraph,
    dependencyGraph.outwardDependencies
  );

  // ============================================================
  // ШАГ 10: Резюме проекта
  // ============================================================
  // --- НАЧАЛО ИЗМЕНЕНИЙ ---
  // Сначала собираем "черновой" отчет, чтобы передать его в buildSummary
  // (buildSummary принимает 1 аргумент — объект отчета, а не 3).
  const reportWithoutSummary: Omit<EnhancedPackageLockReport, 'summary'> = {
    ...metadata,

    packages,

    dependencyGraph: {
      direction: 'bidirectional' as const,
      inwardDependencies: dependencyGraph.inwardDependencies || {},
      outwardDependencies: dependencyGraph.outwardDependencies || {},
    },

    executionGraph,

    importExportFlow: safeImportExportFlow,

    callGraph,

    entityStats,
    fileStats,
    architectureMetrics,
  };

  const summary = buildSummary(reportWithoutSummary as EnhancedPackageLockReport);
  // --- КОНЕЦ ИЗМЕНЕНИЙ ---

  // ============================================================
  // ШАГ 11: Финальная сборка
  // ============================================================
  return {
    ...reportWithoutSummary,
    summary, // <-- Добавляем summary
  };
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default buildEnhancedPackageLockReport;
