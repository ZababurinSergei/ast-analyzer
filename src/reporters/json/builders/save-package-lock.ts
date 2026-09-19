// packages/ast-analyzer/src/reporters/json/builders/save-package-lock.ts

import fs from 'fs';
import path from 'path';
import type { EntitiesResult } from '../../../types.js';
import { buildDependencyGraph } from '../../modules/graphs.js';
import { buildExecutionGraph, buildImportExportFlow } from '../../modules/flows.js';
import { buildArchitectureMetrics } from '../../modules/architecture.js';
import { buildSummary } from '../../modules/summary.js';
import { calculateEntityStats, calculateFileStats } from '../../modules/statistics.js';
import { ensureArray } from '../../modules/utils.js';
import { createDefaultSecurity } from '../../modules/types.js';
import type { FunctionEntity } from '../../modules/types.js';
import { detectLanguage } from '../utils/language-detector.js';
import { computeExportConsumers } from '../consumers/export-consumers.js';
import idManager from '../../../core/IdManager.js';

// ✅ v9.0.5-fix: безопасная сериализация (BigInt, Map, Set, Circular)
import { safeJsonStringify } from '../../../utils/safe-json.js';

// ============================================================
// ТИПЫ
// ============================================================

interface SavePackageLockOptions {
  includeBody?: boolean;
}

interface ExportEntry {
  direction: 'outward';
  type: string;
  line: number;
  consumers: any[];
  [key: string]: any;
}

interface ImportEntry {
  direction: 'inward';
  type: string;
  specifiers: string[];
  functions: Record<string, any>;
}

// ============================================================
// ОСНОВНАЯ ПУБЛИЧНАЯ ФУНКЦИЯ
// ============================================================

/**
 * Сохраняет enhanced package-lock report на диск.
 *
 * Используется в cli.ts при вызове `pipeline` и других команд.
 *
 * Этапы:
 *   1. Нормализация EntitiesResult (гарантирует массивы и ID)
 *   2. Построение packages + exportsMap + importsMap
 *   3. Вычисление consumers (кто импортирует / вызывает)
 *   4. Построение dependencyGraph, executionGraph, importExportFlow
 *   5. Сборка финального отчёта
 *   6. Сохранение JSON на диск
 *   7. Логирование статистики
 */
export function savePackageLockReport(
  rootKey: string,
  graph: Record<string, string[]>,
  entitiesMap: Record<string, EntitiesResult>,
  _filePaths: string[],
  outputPath: string,
  _options?: SavePackageLockOptions
): void {
  // Очищаем кэш IdManager перед генерацией
  idManager.clear();

  // Шаг 1: Нормализация сущностей
  const normalizedEntitiesMap = normalizeEntitiesMap(entitiesMap);

  // Шаг 2: Построение пакетов, exportsMap и importsMap
  const { packages, exportsMap } = buildPackagesAndMaps(rootKey, normalizedEntitiesMap);

  // Шаг 3: Вычисление consumers для всех экспортов
  computeExportConsumers(graph, normalizedEntitiesMap, exportsMap);

  // Применяем вычисленные consumers к packages
  applyConsumersToPackages(packages, exportsMap);

  // Шаг 4: Построение графов
  const dependencyGraph = buildDependencyGraph(graph);
  const executionGraph = buildExecutionGraph(
    rootKey,
    normalizedEntitiesMap,
    { rootKey, graph },
    packages
  );

  const rawImportExportFlow = buildImportExportFlow(
    graph,
    normalizedEntitiesMap,
    { rootKey, graph },
    packages
  );

  // --- НАЧАЛО ИЗМЕНЕНИЙ ---
  // Шаг 5: Сборка финального отчёта (без summary)
  const reportWithoutSummary = buildFinalReportWithoutSummary({
    rootKey,
    graph,
    normalizedEntitiesMap,
    packages,
    dependencyGraph,
    executionGraph,
    rawImportExportFlow,
  });

  // Вычисляем summary на основе собранного отчёта
  const summary = buildSummary(reportWithoutSummary as any);

  // Добавляем summary в финальный отчёт
  const report = { ...reportWithoutSummary, summary };
  // --- КОНЕЦ ИЗМЕНЕНИЙ ---

  // Шаг 6: Сохранение JSON
  saveReportToDisk(report, outputPath);

  // Шаг 7: Логирование статистики
  logReportSummary(report, outputPath);
}

// ============================================================
// ШАГ 1: НОРМАЛИЗАЦИЯ СУЩНОСТЕЙ
// ============================================================

/**
 * Нормализует EntitiesResult:
 *   - гарантирует, что все поля — массивы
 *   - восстанавливает ID и VSCode-ссылки для функций
 *   - добавляет default security, complexity и т.д.
 */
function normalizeEntitiesMap(
  entitiesMap: Record<string, EntitiesResult>
): Record<string, EntitiesResult> {
  const normalized: Record<string, EntitiesResult> = {};

  for (const [key, entities] of Object.entries(entitiesMap)) {
    if (!entities || typeof entities !== 'object') {
      normalized[key] = createEmptyEntitiesResult();
      continue;
    }

    normalized[key] = {
      functions: ensureArray(entities.functions).map((f: any) => normalizeFunction(f, key)),
      classes: ensureArray(entities.classes),
      constants: ensureArray(entities.constants),
      interfaces: ensureArray(entities.interfaces),
      types: ensureArray(entities.types),
      variables: ensureArray(entities.variables),
      imports: ensureArray(entities.imports),
      exports: ensureArray(entities.exports),
      callGraph: entities.callGraph || {},
      moduleName: entities.moduleName || '',
      filePath: entities.filePath || '',
    };
  }

  return normalized;
}

/**
 * Нормализует одну функцию: ID, VSCode-ссылку, массивы, security.
 */
function normalizeFunction(f: any, filePath: string): any {
  return {
    ...f,
    id:
      f.id ||
      idManager.getFunctionId({
        filePath,
        funcName: f.name,
        line: f.line || 0,
        parentFunction: f.parentFunction,
        depth: f.depth || 0,
      }),
    vscode: f.vscode || `vscode://file/${filePath}:${f.line}`,
    calls: ensureArray(f.calls),
    calledBy: ensureArray(f.calledBy),
    callsInfo: ensureArray(f.callsInfo),
    calledByInfo: ensureArray(f.calledByInfo),
    importedBy: ensureArray(f.importedBy),
    body: f.body || '',
    complexity: f.complexity || 1,
    security: f.security || createDefaultSecurity(),
  };
}

/**
 * Создаёт пустой EntitiesResult.
 */
function createEmptyEntitiesResult(): EntitiesResult {
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
    moduleName: '',
    filePath: '',
  };
}

// ============================================================
// ШАГ 2: ПОСТРОЕНИЕ ПАКЕТОВ, EXPORTSMAP И IMPORTSMAP
// ============================================================

/**
 * Строит packages, exportsMap и возвращает их.
 *
 * exportsMap используется для последующего вычисления consumers.
 */
function buildPackagesAndMaps(
  rootKey: string,
  entitiesMap: Record<string, EntitiesResult>
): {
  packages: Record<string, any>;
  exportsMap: Record<string, Record<string, ExportEntry>>;
} {
  const packages: Record<string, any> = {};
  const exportsMap: Record<string, Record<string, ExportEntry>> = {};

  for (const [modulePath, entities] of Object.entries(entitiesMap)) {
    if (!entities) continue;

    const exports = buildExportsForModule(entities);
    exportsMap[modulePath] = exports;

    const imports = buildImportsForModule(entities);

    const language = detectLanguage(modulePath);
    const isEntry = modulePath === rootKey;

    packages[modulePath] = {
      version: '1.0.0',
      resolved: `file:${modulePath}`,
      displayPath: modulePath,
      type: 'module',
      language,
      isEntry,
      imports,
      exports,
      entities: {
        functions: entities.functions || [],
        constants: entities.constants || [],
        variables: entities.variables || [],
        interfaces: entities.interfaces || [],
        types: entities.types || [],
        classes: entities.classes || [],
      },
      fileStats: {
        size: 0,
        lines: 0,
        functions: (entities.functions || []).length,
        classes: (entities.classes || []).length,
        constants: (entities.constants || []).length,
        interfaces: (entities.interfaces || []).length,
        types: (entities.types || []).length,
        variables: (entities.variables || []).length,
      },
      vscode: `vscode://file/${modulePath}`,
    };
  }

  return { packages, exportsMap };
}

/**
 * Строит карту экспортов для одного модуля.
 *
 * Обрабатывает:
 *   - функции (isExported)
 *   - константы (isExported)
 *   - переменные (isExported)
 *   - классы (isExported)
 *   - интерфейсы (isExported)
 *   - типы (isExported)
 *   - ✅ НОВОЕ: реэкспорты (export * from, export { x } from)
 */
function buildExportsForModule(entities: EntitiesResult): Record<string, ExportEntry> {
  const exports: Record<string, ExportEntry> = {};

  // === Функции ===
  for (const func of entities.functions || []) {
    if (func.isExported && func.name) {
      exports[func.name] = {
        direction: 'outward',
        type: 'function',
        isAsync: func.isAsync || false,
        params: func.params || [],
        returns: func.returnType || 'any',
        line: func.line || 0,
        consumers: [],
        id: func.id || '',
        vscode: func.vscode || '',
      } as any;
    }
  }

  // === Константы ===
  for (const constItem of entities.constants || []) {
    if (constItem.isExported && constItem.name) {
      exports[constItem.name] = {
        direction: 'outward',
        type: 'constant',
        value: constItem.value,
        line: constItem.line || 0,
        consumers: [],
      };
    }
  }

  // === Переменные ===
  for (const varItem of entities.variables || []) {
    if (varItem.isExported && varItem.name) {
      exports[varItem.name] = {
        direction: 'outward',
        type: 'variable',
        value: varItem.value,
        line: varItem.line || 0,
        consumers: [],
      };
    }
  }

  // === Классы ===
  for (const cls of entities.classes || []) {
    if (cls.isExported && cls.name) {
      exports[cls.name] = {
        direction: 'outward',
        type: 'class',
        methods: cls.methods || [],
        line: cls.line || 0,
        consumers: [],
      };
    }
  }

  // === Интерфейсы ===
  for (const intf of entities.interfaces || []) {
    if (intf.isExported && intf.name) {
      exports[intf.name] = {
        direction: 'outward',
        type: 'interface',
        properties: intf.properties || [],
        line: intf.line || 0,
        consumers: [],
      };
    }
  }

  // === Типы ===
  for (const type of entities.types || []) {
    if (type.isExported && type.name) {
      exports[type.name] = {
        direction: 'outward',
        type: 'type',
        definition: type.definition || '',
        line: type.line || 0,
        consumers: [],
      };
    }
  }

  // === ✅ НОВОЕ: РЕЭКСПОРТЫ (export * from) ===
  for (const exp of entities.exports || []) {
    const expAny = exp as any;
    if (expAny.isReExport) {
      const exportKey = expAny.isStarReExport ? `*:${expAny.source}` : exp.name;

      exports[exportKey] = {
        direction: 'outward',
        type: 're-export',
        line: expAny.startLine || 0,
        consumers: [],
        exportName: '*',
        localName: '*',
        source: expAny.source,
        isTypeOnly: expAny.isTypeOnly || false,
        isReExport: true,
        isStarReExport: true,
        isDefaultReExport: false,
      };
    }
  }

  return exports;
}

/**
 * Строит карту импортов для одного модуля.
 */
function buildImportsForModule(entities: EntitiesResult): Record<string, ImportEntry> {
  const imports: Record<string, ImportEntry> = {};

  for (const imp of entities.imports || []) {
    if (imp.source) {
      imports[imp.source] = {
        direction: 'inward',
        type: 'import',
        specifiers: (imp.specifiers || []).map((s: any) =>
          typeof s === 'string' ? s : s.imported || s.local || ''
        ),
        functions: {},
      };
    }
  }

  return imports;
}

// ============================================================
// ШАГ 3: ПРИМЕНЕНИЕ CONSUMERS
// ============================================================

/**
 * Применяет вычисленные consumers к packages.
 *
 * computeExportConsumers мутирует exportsMap (добавляет consumers в
 * каждый экспорт), поэтому достаточно заменить pkg.exports на exportsMap.
 */
function applyConsumersToPackages(
  packages: Record<string, any>,
  exportsMap: Record<string, Record<string, ExportEntry>>
): void {
  for (const [modulePath, pkg] of Object.entries(packages)) {
    if (exportsMap[modulePath]) {
      pkg.exports = exportsMap[modulePath];
    }
  }
}

// ============================================================
// ШАГ 4: СБОРКА ФИНАЛЬНОГО ОТЧЁТА
// ============================================================

interface BuildFinalReportParams {
  rootKey: string;
  graph: Record<string, string[]>;
  normalizedEntitiesMap: Record<string, EntitiesResult>;
  packages: Record<string, any>;
  dependencyGraph: {
    inwardDependencies: Record<string, string[]>;
    outwardDependencies: Record<string, string[]>;
  };
  executionGraph: any;
  rawImportExportFlow: any;
}

// --- НАЧАЛО ИЗМЕНЕНИЙ ---
/**
 * Собирает финальный отчёт БЕЗ поля summary.
 *
 * Поле summary добавляется отдельно в savePackageLockReport,
 * после того как все остальные поля собраны.
 */
function buildFinalReportWithoutSummary(params: BuildFinalReportParams): any {
  const { normalizedEntitiesMap, packages, dependencyGraph, executionGraph, rawImportExportFlow } =
    params;

  const safeImportExportFlow = sanitizeImportExportFlow(rawImportExportFlow);
  const callGraph = buildFlatCallGraph(normalizedEntitiesMap);

  const entityStats = calculateEntityStats(packages, callGraph);
  const fileStats = calculateFileStats(packages);
  const architectureMetrics = buildArchitectureMetrics(
    packages,
    callGraph,
    dependencyGraph.outwardDependencies
  );

  return {
    name: 'ast-analyzer',
    version: '3.0.0',
    lockfileVersion: 3,
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
    timestamp: new Date().toISOString(),
  };
}
// --- КОНЕЦ ИЗМЕНЕНИЙ ---

/**
 * Санитайзит importExportFlow: гарантирует массивы, фильтрует пустые строки.
 */
function sanitizeImportExportFlow(rawImportExportFlow: any): any {
  return {
    imports: Object.fromEntries(
      Object.entries(rawImportExportFlow.imports || {}).map(([key, value]) => [
        key,
        {
          importsFrom: ((value as any)?.importsFrom || []).map((item: any) => ({
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
          exportsTo: ((value as any)?.exportsTo || []).map((item: any) => ({
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
}

/**
 * Строит «плоский» callGraph: { "ClassName.methodName" | "funcName" → string[] }.
 */
function buildFlatCallGraph(entitiesMap: Record<string, EntitiesResult>): Record<string, string[]> {
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

  return callGraph;
}

// ============================================================
// ШАГ 5: СОХРАНЕНИЕ JSON НА ДИСК
// ============================================================

/**
 * Сохраняет отчёт на диск.
 *
 * ✅ v9.0.5-fix: используется safeJsonStringify вместо JSON.stringify.
 *
 * Причина: нативный JSON.stringify падает с ошибкой
 *   `TypeError: Do not know how to serialize a BigInt`
 * если в отчёте встречается BigInt-значение (например, в константе
 * вида `const MAX = 18446744073709551615n;`).
 *
 * safeJsonStringify обрабатывает:
 *   - BigInt → строка
 *   - Map    → объект
 *   - Set    → массив
 *   - циклические ссылки → '[Circular]'
 *   - опасные ключи (__proto__, constructor, _safeInfo) → удаляются
 */
function saveReportToDisk(report: any, outputPath: string): void {
  // ✅ ИСПРАВЛЕНО: безопасная сериализация (BigInt, Map, Set, Circular)
  const json = safeJsonStringify(report);

  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, json, 'utf-8');
}

// ============================================================
// ШАГ 6: ЛОГИРОВАНИЕ
// ============================================================

/**
 * Логирует итоговую статистику отчёта.
 */
function logReportSummary(report: any, outputPath: string): void {
  let totalWithBodies = 0;
  let totalWithVSCode = 0;

  for (const pkg of Object.values(report.packages || {})) {
    for (const func of (pkg as any).entities?.functions || []) {
      if (func.body) totalWithBodies++;
      if (func.vscode) totalWithVSCode++;
    }
  }

  // Проверка дублирующихся ID
  const validation = idManager.validate();
  if (!validation.valid) {
    console.warn(`⚠️ Найдены дублирующиеся ID: ${validation.duplicates.join(', ')}`);
  }

  const stats = idManager.getStats();
  console.log(`\n🔑 СТАТИСТИКА ID (savePackageLockReport):`);
  console.log(`   📝 Всего сгенерировано ID: ${stats.total}`);
  console.log(`   ✅ Уникальных ID: ${stats.unique}`);

  console.log(`✅ Enhanced package-lock report saved: ${outputPath}`);
  console.log(`📊 Functions: ${report.entityStats?.totalFunctions || 0}`);
  console.log(`📊 Constants: ${report.entityStats?.totalConstants || 0}`);
  console.log(`📊 Variables: ${report.entityStats?.totalVariables || 0}`);
  console.log(`📊 Interfaces: ${report.entityStats?.totalInterfaces || 0}`);
  console.log(`📊 Types: ${report.entityStats?.totalTypes || 0}`);
  console.log(`📊 Classes: ${report.entityStats?.totalClasses || 0}`);
  console.log(`📞 Calls: ${report.entityStats?.totalCalls || 0}`);
  console.log(`📁 Files: ${report.fileStats?.totalFiles || 0}`);
  console.log(`📝 Lines: ${report.fileStats?.totalLines || 0}`);
  console.log(`💾 Size: ${((report.fileStats?.totalSize || 0) / 1024).toFixed(2)} KB`);
  console.log(`📖 Functions with body: ${totalWithBodies}`);
  console.log(`🔗 Functions with VSCode link: ${totalWithVSCode}`);

  if (report.architectureMetrics) {
    console.log(`🏗️  Architecture: ${report.summary?.architectureHealth || 'unknown'}`);
    console.log(`   📦 Vue components: ${report.architectureMetrics.vueComponents}`);
    console.log(`   🔄 Cycles: ${report.architectureMetrics.hasCycles ? '⚠️ YES' : '✅ NO'}`);
    console.log(`   📏 Max depth: ${report.architectureMetrics.maxDepth}`);
  }
}
