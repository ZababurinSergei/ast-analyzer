// src/reporters/modules/flows.ts
// Потоки выполнения и импортов/экспортов

import { EnhancedPackageInfo, EntitiesResult, GraphData } from './types.js';
import { safeString, ensureArray } from './utils.js';

export interface ExecutionGraph {
  entryPoint: string;
  direction: 'top-down';
  entryFunctions: string[];
  executionFlow: {
    type: 'sequential' | 'parallel' | 'conditional';
    steps: {
      func: string;
      module: string;
      direction: 'inward' | 'outward' | 'self';
      isAsync: boolean;
      branches?: Record<string, any>;
    }[];
  };
}

export interface ImportExportFlow {
  imports: Record<
    string,
    {
      importsFrom: {
        module: string;
        type: 'named' | 'default' | 'namespace';
        imports: string[];
      }[];
    }
  >;
  exports: Record<
    string,
    {
      exportsTo: {
        module: string;
        type: 'named' | 'default';
        exports: string[];
      }[];
    }
  >;
}

/**
 * Строит граф выполнения на основе точек входа
 *
 * @param rootKey - Корневой модуль (точка входа)
 * @param entitiesMap - Карта сущностей по модулям
 * @param graphData - Данные графа зависимостей (используется для анализа структуры)
 * @param packages - Данные по пакетам (используется для обогащения информации)
 * @returns ExecutionGraph - Граф выполнения
 */
export function buildExecutionGraph(
  rootKey: string,
  entitiesMap: Record<string, EntitiesResult>,
  graphData?: GraphData,
  packages?: Record<string, EnhancedPackageInfo>
): ExecutionGraph {
  const entryFunctions: string[] = [];
  const rootEntities = entitiesMap[rootKey];

  // ============================================
  // 1. АНАЛИЗ ГРАФА ДЛЯ ОПРЕДЕЛЕНИЯ СТРУКТУРЫ
  // ============================================
  let hasCyclicDependencies = false;
  const cyclicEdgesList: string[] = [];
  const graphStructure: Record<string, string[]> = {};

  if (graphData) {
    Object.assign(graphStructure, graphData.graph || {});
    hasCyclicDependencies = graphData.hasCycles || false;
    cyclicEdgesList.push(...(graphData.cyclicEdges || []));

    // Логируем информацию о структуре графа для отладки
    if (hasCyclicDependencies) {
      console.log(
        `🔴 Обнаружены циклические зависимости в графе (${cyclicEdgesList.length} ребер)`
      );
    }
  }

  // ============================================
  // 2. ОБОГАЩЕНИЕ ДАННЫМИ ИЗ PACKAGES
  // ============================================
  let rootPackageInfo: EnhancedPackageInfo | null = null;
  let rootLanguage = 'typescript';
  let rootType = 'module';
  const rootFileStats = {
    size: 0,
    lines: 0,
    functions: 0,
    classes: 0,
    constants: 0,
    interfaces: 0,
    types: 0,
    variables: 0,
  };

  if (packages && packages[rootKey]) {
    rootPackageInfo = packages[rootKey];
    rootLanguage = rootPackageInfo.language || 'typescript';
    rootType = rootPackageInfo.type || 'module';
    Object.assign(rootFileStats, rootPackageInfo.fileStats || {});

    // Используем информацию о пакете для обогащения данных
    console.log(`📦 Корневой модуль: ${rootKey} (${rootLanguage}, ${rootType})`);
    console.log(`   📊 Функций: ${rootFileStats.functions}, Классов: ${rootFileStats.classes}`);
  }

  // ============================================
  // 3. ОПРЕДЕЛЕНИЕ ТОЧЕК ВХОДА
  // ============================================
  if (rootEntities && typeof rootEntities === 'object') {
    const functions = ensureArray(rootEntities.functions);
    for (const func of functions) {
      if (func && typeof func === 'object') {
        // Безопасное получение свойств
        const funcObj = func as Record<string, any>;
        const isExported = funcObj.isExported === true;
        const funcName = safeString(funcObj.name);

        if (isExported && funcName) {
          entryFunctions.push(funcName);
        }
      }
    }
  }

  // ============================================
  // 4. ПОСТРОЕНИЕ ШАГОВ ВЫПОЛНЕНИЯ
  // ============================================
  const executionSteps: {
    func: string;
    module: string;
    direction: 'inward' | 'outward' | 'self';
    isAsync: boolean;
    branches?: Record<string, any>;
  }[] = [];

  if (rootEntities && typeof rootEntities === 'object') {
    const functions = ensureArray(rootEntities.functions);
    for (const func of functions) {
      if (func && typeof func === 'object') {
        const funcObj = func as Record<string, any>;
        const isExported = funcObj.isExported === true;
        const funcName = safeString(funcObj.name);

        if (!isExported || !funcName) {
          continue;
        }

        // Проверяем, участвует ли функция в циклической зависимости
        let isInCycle = false;
        if (hasCyclicDependencies && cyclicEdgesList.length > 0) {
          for (const edge of cyclicEdgesList) {
            if (edge.includes(funcName)) {
              isInCycle = true;
              break;
            }
          }
        }

        // Проверяем, есть ли у функции асинхронные вызовы
        const calls = ensureArray(funcObj.calls || []);
        let hasAsyncCalls = false;
        const asyncCallTargets: string[] = [];

        for (const call of calls) {
          const callStr = safeString(call);
          if (!callStr) continue;

          // Ищем вызываемую функцию в entitiesMap
          for (const [_modulePath, moduleEntities] of Object.entries(entitiesMap)) {
            if (!moduleEntities || typeof moduleEntities !== 'object') {
              continue;
            }

            const moduleFunctions = ensureArray((moduleEntities as any).functions || []);
            for (const calledFunc of moduleFunctions) {
              if (!calledFunc || typeof calledFunc !== 'object') {
                continue;
              }

              const calledObj = calledFunc as Record<string, any>;
              const calledName = safeString(calledObj.name);
              const calledIsAsync = calledObj.isAsync === true;

              if (calledName === callStr && calledIsAsync) {
                hasAsyncCalls = true;
                asyncCallTargets.push(callStr);
                break;
              }
            }
            if (hasAsyncCalls) break;
          }
        }

        // Определяем направление на основе структуры графа
        let direction: 'inward' | 'outward' | 'self' = 'self';
        if (graphStructure[rootKey]) {
          const deps = graphStructure[rootKey] || [];
          if (deps.some(d => d.includes(funcName))) {
            direction = 'outward';
          }
        }

        // Строим branches с обогащенной информацией
        const branches: Record<string, any> = {};

        if (isInCycle) {
          branches.isCyclic = true;
        }

        if (hasAsyncCalls) {
          branches.hasAsyncCalls = true;
          branches.asyncCallTargets = asyncCallTargets;
        }

        if (rootPackageInfo) {
          branches.moduleLanguage = rootLanguage;
          branches.moduleType = rootType;
          branches.moduleStats = rootFileStats;
        }

        executionSteps.push({
          func: funcName,
          module: rootKey,
          direction: direction,
          isAsync: funcObj.isAsync === true || hasAsyncCalls,
          branches: Object.keys(branches).length > 0 ? branches : undefined,
        });
      }
    }
  }

  // ============================================
  // 5. ОПРЕДЕЛЕНИЕ ТИПА ПОТОКА ВЫПОЛНЕНИЯ
  // ============================================
  let flowType: 'sequential' | 'parallel' | 'conditional' = 'sequential';

  // Если есть асинхронные вызовы, поток может быть параллельным
  if (executionSteps.some(s => s.isAsync)) {
    flowType = 'parallel';
  }

  // Если есть циклические зависимости, поток может быть условным
  if (executionSteps.some(s => s.branches?.isCyclic)) {
    flowType = 'conditional';
  }

  return {
    entryPoint: rootKey,
    direction: 'top-down',
    entryFunctions,
    executionFlow: {
      type: flowType,
      steps: executionSteps,
    },
  };
}

/**
 * Строит потоки импортов и экспортов между модулями
 *
 * @param graph - Граф зависимостей
 * @param entitiesMap - Карта сущностей по модулям
 * @param graphData - Данные графа (используется для анализа связей)
 * @param packages - Данные по пакетам (используется для обогащения информации об импортах/экспортах)
 * @returns ImportExportFlow - Потоки импортов и экспортов
 */
export function buildImportExportFlow(
  graph: Record<string, string[]>,
  entitiesMap: Record<string, EntitiesResult>,
  graphData?: GraphData,
  packages?: Record<string, EnhancedPackageInfo>
): ImportExportFlow {
  const importsFlow: ImportExportFlow['imports'] = {};
  const exportsFlow: ImportExportFlow['exports'] = {};

  // ============================================
  // 1. АНАЛИЗ СТРУКТУРЫ ГРАФА
  // ============================================
  let hasCyclicDependencies = false;
  const cyclicEdgesList: string[] = [];

  if (graphData) {
    hasCyclicDependencies = graphData.hasCycles || false;
    cyclicEdgesList.push(...(graphData.cyclicEdges || []));

    if (hasCyclicDependencies) {
      console.log(`🔄 Обнаружены циклические зависимости в потоках импортов/экспортов`);
    }
  }

  // ============================================
  // 2. ИНИЦИАЛИЗАЦИЯ СТРУКТУР
  // ============================================
  const modulePaths = Object.keys(graph);
  for (const modulePath of modulePaths) {
    importsFlow[modulePath] = { importsFrom: [] };
    exportsFlow[modulePath] = { exportsTo: [] };
  }

  // ============================================
  // 3. ОБОГАЩЕНИЕ ДАННЫМИ ИЗ PACKAGES
  // ============================================
  const packageInfoMap = new Map<string, EnhancedPackageInfo>();
  if (packages) {
    for (const [modulePath, pkg] of Object.entries(packages)) {
      packageInfoMap.set(modulePath, pkg);
    }
  }

  // ============================================
  // 4. ОБРАБОТКА ИМПОРТОВ И ЭКСПОРТОВ
  // ============================================
  for (const modulePath of modulePaths) {
    const entities = entitiesMap[modulePath];
    if (!entities || typeof entities !== 'object') {
      continue;
    }

    // ============================================
    // 4a. ОБРАБОТКА ИМПОРТОВ
    // ============================================
    const imports = ensureArray((entities as any).imports || []);
    for (const imp of imports) {
      if (!imp || typeof imp !== 'object') {
        continue;
      }

      const impObj = imp as Record<string, any>;
      const source = safeString(impObj.source);
      if (!source) {
        continue;
      }

      // Проверяем, является ли импорт внутренним (из проекта)
      let isInternal = false;
      let targetModulePath = '';
      for (const modPath of modulePaths) {
        if (modPath.includes(source) || source.includes(modPath)) {
          isInternal = true;
          targetModulePath = modPath;
          break;
        }
      }

      if (!isInternal) {
        continue; // Пропускаем внешние импорты
      }

      // Проверяем, не является ли этот импорт циклическим
      if (hasCyclicDependencies && cyclicEdgesList.length > 0) {
        for (const edge of cyclicEdgesList) {
          if (edge.includes(modulePath) && edge.includes(targetModulePath)) {
            // Циклический импорт найден
            break;
          }
        }
      }

      // Получаем specifiers
      let specifiers: string[] = [];
      const impSpecifiers = ensureArray(impObj.specifiers || []);
      for (const spec of impSpecifiers) {
        if (typeof spec === 'string') {
          specifiers.push(spec);
        } else if (spec && typeof spec === 'object') {
          const specObj = spec as Record<string, any>;
          const local = safeString(specObj.local);
          const imported = safeString(specObj.imported);
          if (local) {
            specifiers.push(local);
          } else if (imported) {
            specifiers.push(imported);
          }
        }
      }

      // Фильтруем пустые specifiers
      const validSpecifiers = specifiers.filter(s => s && s.length > 0);
      if (validSpecifiers.length === 0) {
        continue;
      }

      // Проверяем, что importsFlow[modulePath] существует
      if (!importsFlow[modulePath]) {
        importsFlow[modulePath] = { importsFrom: [] };
      }

      // Проверяем, нет ли уже такого импорта
      let existingImport = false;
      for (const existing of importsFlow[modulePath].importsFrom) {
        if (existing.module === source) {
          existingImport = true;
          // Добавляем новые specifiers, которых еще нет
          for (const spec of validSpecifiers) {
            if (!existing.imports.includes(spec)) {
              existing.imports.push(spec);
            }
          }
          break;
        }
      }

      if (!existingImport) {
        importsFlow[modulePath].importsFrom.push({
          module: source,
          type: 'named',
          imports: validSpecifiers,
        });
      }
    }

    // ============================================
    // 4b. ОБРАБОТКА ЭКСПОРТОВ
    // ============================================
    const functions = ensureArray((entities as any).functions || []);
    for (const func of functions) {
      if (!func || typeof func !== 'object') {
        continue;
      }

      const funcObj = func as Record<string, any>;
      const isExported = funcObj.isExported === true;
      if (!isExported) {
        continue;
      }

      const funcName = safeString(funcObj.name);
      if (!funcName) {
        continue;
      }

      // Ищем, кто импортирует эту функцию
      for (const [importerModule, importerEntities] of Object.entries(entitiesMap)) {
        if (importerModule === modulePath) {
          continue; // Пропускаем себя
        }

        if (!importerEntities || typeof importerEntities !== 'object') {
          continue;
        }

        // Проверяем, не является ли этот экспорт циклическим
        if (hasCyclicDependencies && cyclicEdgesList.length > 0) {
          for (const edge of cyclicEdgesList) {
            if (edge.includes(modulePath) && edge.includes(importerModule)) {
              // Циклический экспорт найден
              break;
            }
          }
        }

        const importerImports = ensureArray((importerEntities as any).imports || []);
        for (const imp of importerImports) {
          if (!imp || typeof imp !== 'object') {
            continue;
          }

          const impObj = imp as Record<string, any>;
          const source = safeString(impObj.source);
          if (!source) {
            continue;
          }

          // Проверяем, импортирует ли этот модуль наш модуль
          const isImporting = source.includes(modulePath) || modulePath.includes(source);
          if (!isImporting) {
            continue;
          }

          // Получаем specifiers из импорта
          const impSpecifiers = ensureArray(impObj.specifiers || []);
          let foundFunc = false;

          for (const spec of impSpecifiers) {
            let specName = '';
            if (typeof spec === 'string') {
              specName = spec;
            } else if (spec && typeof spec === 'object') {
              const specObj = spec as Record<string, any>;
              specName = safeString(specObj.local || specObj.imported || '');
            }

            if (specName === funcName) {
              foundFunc = true;
              break;
            }
          }

          if (foundFunc) {
            // Проверяем, что exportsFlow[modulePath] существует
            if (!exportsFlow[modulePath]) {
              exportsFlow[modulePath] = { exportsTo: [] };
            }

            // Проверяем, нет ли уже такого экспорта
            let existingExport = false;
            for (const existing of exportsFlow[modulePath].exportsTo) {
              if (existing.module === importerModule) {
                existingExport = true;
                if (!existing.exports.includes(funcName)) {
                  existing.exports.push(funcName);
                }
                break;
              }
            }

            if (!existingExport) {
              exportsFlow[modulePath].exportsTo.push({
                module: importerModule,
                type: 'named',
                exports: [funcName],
              });
            }
          }
        }
      }
    }
  }

  // ============================================
  // 5. УДАЛЕНИЕ ДУБЛИКАТОВ
  // ============================================
  for (const modulePath of modulePaths) {
    // Очищаем imports
    if (importsFlow[modulePath]) {
      const uniqueImports: {
        module: string;
        type: 'named' | 'default' | 'namespace';
        imports: string[];
      }[] = [];
      for (const imp of importsFlow[modulePath].importsFrom) {
        let exists = false;
        for (const existing of uniqueImports) {
          if (existing.module === imp.module) {
            exists = true;
            // Объединяем imports
            for (const spec of imp.imports) {
              if (!existing.imports.includes(spec)) {
                existing.imports.push(spec);
              }
            }
            break;
          }
        }
        if (!exists) {
          uniqueImports.push({ ...imp, imports: [...imp.imports] });
        }
      }
      importsFlow[modulePath].importsFrom = uniqueImports;
    }

    // Очищаем exports
    if (exportsFlow[modulePath]) {
      const uniqueExports: { module: string; type: 'named' | 'default'; exports: string[] }[] = [];
      for (const exp of exportsFlow[modulePath].exportsTo) {
        let exists = false;
        for (const existing of uniqueExports) {
          if (existing.module === exp.module) {
            exists = true;
            for (const spec of exp.exports) {
              if (!existing.exports.includes(spec)) {
                existing.exports.push(spec);
              }
            }
            break;
          }
        }
        if (!exists) {
          uniqueExports.push({ ...exp, exports: [...exp.exports] });
        }
      }
      exportsFlow[modulePath].exportsTo = uniqueExports;
    }
  }

  return {
    imports: importsFlow,
    exports: exportsFlow,
  };
}

/**
 * Находит все функции, которые являются точками входа
 *
 * @param entitiesMap - Карта сущностей
 * @param rootKey - Корневой модуль
 * @param graphData - Данные графа (используется для анализа связей)
 * @param packages - Данные по пакетам (используется для обогащения)
 * @returns Список функций-точек входа с обогащенной информацией
 */
export function findEntryFunctions(
  entitiesMap: Record<string, EntitiesResult>,
  rootKey: string,
  graphData?: GraphData,
  packages?: Record<string, EnhancedPackageInfo>
): string[] {
  const entryFunctions: string[] = [];
  const rootEntities = entitiesMap[rootKey];

  // Используем graphData для анализа структуры
  if (graphData) {
    const hasCycles = graphData.hasCycles || false;
    if (hasCycles) {
      console.log(`⚠️ Граф содержит циклические зависимости, точки входа определяются по rootKey`);
    }
  }

  // Используем packages для получения информации о корневом модуле
  if (packages && packages[rootKey]) {
    const pkg = packages[rootKey];
    console.log(`📦 Корневой пакет: ${rootKey} (${pkg.language}, ${pkg.type})`);
  }

  if (rootEntities && typeof rootEntities === 'object') {
    const functions = ensureArray((rootEntities as any).functions || []);
    for (const func of functions) {
      if (func && typeof func === 'object') {
        const funcObj = func as Record<string, any>;
        const isExported = funcObj.isExported === true;
        const funcName = safeString(funcObj.name);

        if (isExported && funcName) {
          entryFunctions.push(funcName);
        }
      }
    }
  }

  // Если точек входа не найдено, используем все экспортированные функции из корневого модуля
  if (entryFunctions.length === 0 && rootEntities && typeof rootEntities === 'object') {
    const functions = ensureArray((rootEntities as any).functions || []);
    for (const func of functions) {
      if (func && typeof func === 'object') {
        const funcObj = func as Record<string, any>;
        const funcName = safeString(funcObj.name);
        const isExported = funcObj.isExported === true;

        if (funcName && isExported) {
          entryFunctions.push(funcName);
        }
      }
    }
  }

  return entryFunctions;
}

/**
 * Строит граф выполнения с учетом асинхронности
 *
 * @param rootKey - Корневой модуль
 * @param entitiesMap - Карта сущностей
 * @param _callGraph - Граф вызовов (зарезервирован для будущего использования)
 * @param graphData - Данные графа (используется для анализа структуры)
 * @param packages - Данные по пакетам (используется для обогащения)
 * @returns ExecutionGraph - Граф выполнения
 */
export function buildAsyncExecutionGraph(
  rootKey: string,
  entitiesMap: Record<string, EntitiesResult>,
  _callGraph: Record<string, string[]>,
  graphData?: GraphData,
  packages?: Record<string, EnhancedPackageInfo>
): ExecutionGraph {
  const entryFunctions = findEntryFunctions(entitiesMap, rootKey, graphData, packages);

  const steps: {
    func: string;
    module: string;
    direction: 'inward' | 'outward' | 'self';
    isAsync: boolean;
    branches?: Record<string, any>;
  }[] = [];

  // ============================================
  // 1. АНАЛИЗ СТРУКТУРЫ ГРАФА
  // ============================================
  let hasCyclicDependencies = false;
  const cyclicEdgesList: string[] = [];

  if (graphData) {
    hasCyclicDependencies = graphData.hasCycles || false;
    cyclicEdgesList.push(...(graphData.cyclicEdges || []));
  }

  // ============================================
  // 2. ОБОГАЩЕНИЕ ДАННЫМИ ИЗ PACKAGES
  // ============================================
  let rootPackageInfo: EnhancedPackageInfo | null = null;
  if (packages && packages[rootKey]) {
    rootPackageInfo = packages[rootKey];
  }

  // ============================================
  // 3. ПОСТРОЕНИЕ ШАГОВ ВЫПОЛНЕНИЯ
  // ============================================
  const rootEntities = entitiesMap[rootKey];
  if (rootEntities && typeof rootEntities === 'object') {
    const functions = ensureArray((rootEntities as any).functions || []);
    for (const func of functions) {
      if (!func || typeof func !== 'object') {
        continue;
      }

      const funcObj = func as Record<string, any>;
      const isExported = funcObj.isExported === true;
      const funcName = safeString(funcObj.name);

      if (!isExported || !funcName) {
        continue;
      }

      const isAsync = funcObj.isAsync === true;
      const calls = ensureArray(funcObj.calls || []);

      // Проверяем, есть ли асинхронные вызовы
      let hasAsyncCalls = false;
      const asyncCallTargets: string[] = [];

      for (const call of calls) {
        const callStr = safeString(call);
        if (!callStr) continue;

        // Ищем вызываемую функцию в entitiesMap
        for (const [_modulePath, moduleEntities] of Object.entries(entitiesMap)) {
          if (!moduleEntities || typeof moduleEntities !== 'object') {
            continue;
          }

          const moduleFunctions = ensureArray((moduleEntities as any).functions || []);
          for (const calledFunc of moduleFunctions) {
            if (!calledFunc || typeof calledFunc !== 'object') {
              continue;
            }

            const calledObj = calledFunc as Record<string, any>;
            const calledName = safeString(calledObj.name);
            const calledIsAsync = calledObj.isAsync === true;

            if (calledName === callStr && calledIsAsync) {
              hasAsyncCalls = true;
              asyncCallTargets.push(callStr);
              break;
            }
          }
          if (hasAsyncCalls) break;
        }
      }

      // Проверяем, участвует ли функция в циклической зависимости
      let isCyclic = false;
      if (hasCyclicDependencies && cyclicEdgesList.length > 0) {
        for (const edge of cyclicEdgesList) {
          if (edge.includes(funcName)) {
            isCyclic = true;
            break;
          }
        }
      }

      // Получаем информацию о модуле из packages
      let moduleInfo = '';
      const moduleStats = {
        size: 0,
        lines: 0,
        functions: 0,
        classes: 0,
        constants: 0,
        interfaces: 0,
        types: 0,
        variables: 0,
      };

      if (rootPackageInfo) {
        moduleInfo = `${rootPackageInfo.language || ''} ${rootPackageInfo.type || ''}`.trim();
        Object.assign(moduleStats, rootPackageInfo.fileStats || {});
      }

      // Строим branches с обогащенной информацией
      const branches: Record<string, any> = {};

      if (isCyclic) {
        branches.isCyclic = true;
      }

      if (hasAsyncCalls) {
        branches.hasAsyncCalls = true;
        branches.asyncCallTargets = asyncCallTargets;
        branches.asyncCallsCount = asyncCallTargets.length;
      }

      if (moduleInfo) {
        branches.moduleInfo = moduleInfo;
        branches.moduleStats = moduleStats;
      }

      steps.push({
        func: funcName,
        module: rootKey,
        direction: 'self',
        isAsync: isAsync || hasAsyncCalls,
        branches: Object.keys(branches).length > 0 ? branches : undefined,
      });
    }
  }

  // ============================================
  // 4. ОПРЕДЕЛЕНИЕ ТИПА ПОТОКА
  // ============================================
  let flowType: 'sequential' | 'parallel' | 'conditional' = 'sequential';

  if (steps.some(s => s.branches?.hasAsyncCalls)) {
    flowType = 'parallel';
  }

  if (steps.some(s => s.branches?.isCyclic)) {
    flowType = 'conditional';
  }

  return {
    entryPoint: rootKey,
    direction: 'top-down',
    entryFunctions,
    executionFlow: {
      type: flowType,
      steps,
    },
  };
}

/**
 * Проверяет, есть ли циклические зависимости в потоке импортов
 *
 * @param importsFlow - Потоки импортов
 * @param graphData - Данные графа (используется для проверки циклов)
 * @param packages - Данные по пакетам (используется для обогащения)
 * @returns Список циклических зависимостей с обогащенной информацией
 */
export function hasCyclicImports(
  importsFlow: ImportExportFlow['imports'],
  graphData?: GraphData,
  packages?: Record<string, EnhancedPackageInfo>
): { from: string; to: string; cyclePath?: string[]; moduleInfo?: string }[] {
  const cycles: { from: string; to: string; cyclePath?: string[]; moduleInfo?: string }[] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  // Используем graphData для быстрой проверки циклов
  if (graphData && graphData.hasCycles) {
    const cyclicEdges = graphData.cyclicEdges || [];
    for (const edge of cyclicEdges) {
      const parts = edge.split('->');
      const from = parts[0] || '';
      const to = parts[1] || '';
      if (from && to) {
        // Обогащаем информацию о цикле данными из packages
        let moduleInfo = '';
        if (packages && packages[from]) {
          const pkg = packages[from];
          moduleInfo = `${pkg.language || ''} ${pkg.type || ''}`.trim();
        }

        cycles.push({
          from,
          to,
          cyclePath: [from, to],
          moduleInfo: moduleInfo || undefined,
        });
      }
    }
    return cycles;
  }

  // Если в graphData нет информации о циклах, ищем самостоятельно
  const dfs = (modulePath: string, path: string[]) => {
    if (recursionStack.has(modulePath)) {
      const cycleStart = path.indexOf(modulePath);
      if (cycleStart !== -1) {
        const cyclePath = path.slice(cycleStart);
        for (let i = cycleStart; i < path.length - 1; i++) {
          const from = path[i] || '';
          const to = path[i + 1] || '';

          if (from && to) {
            // Обогащаем информацию о цикле
            let moduleInfo = '';
            if (packages && packages[from]) {
              const pkg = packages[from];
              moduleInfo = `${pkg.language || ''} ${pkg.type || ''}`.trim();
            }

            cycles.push({
              from,
              to,
              cyclePath,
              moduleInfo: moduleInfo || undefined,
            });
          }
        }
        // Замыкаем цикл
        const last = path[path.length - 1] || '';
        const first = path[cycleStart] || '';
        if (last && first) {
          let moduleInfo = '';
          if (packages && packages[last]) {
            const pkg = packages[last];
            moduleInfo = `${pkg.language || ''} ${pkg.type || ''}`.trim();
          }
          cycles.push({
            from: last,
            to: first,
            cyclePath,
            moduleInfo: moduleInfo || undefined,
          });
        }
      }
      return;
    }

    if (visited.has(modulePath)) {
      return;
    }

    visited.add(modulePath);
    recursionStack.add(modulePath);
    path.push(modulePath);

    const imports = importsFlow[modulePath]?.importsFrom || [];
    for (const imp of imports) {
      dfs(imp.module, [...path]);
    }

    recursionStack.delete(modulePath);
  };

  for (const modulePath of Object.keys(importsFlow)) {
    if (!visited.has(modulePath)) {
      dfs(modulePath, []);
    }
  }

  return cycles;
}

/**
 * Получает статистику по импортам/экспортам
 *
 * @param importsFlow - Потоки импортов
 * @param exportsFlow - Потоки экспортов
 * @param graphData - Данные графа (используется для анализа структуры)
 * @param packages - Данные по пакетам (используется для обогащения)
 * @returns Статистика импортов/экспортов
 */
export function getImportExportStats(
  importsFlow: ImportExportFlow['imports'],
  exportsFlow: ImportExportFlow['exports'],
  graphData?: GraphData,
  packages?: Record<string, EnhancedPackageInfo>
): {
  totalImports: number;
  totalExports: number;
  modulesWithImports: number;
  modulesWithExports: number;
  avgImportsPerModule: number;
  avgExportsPerModule: number;
  cyclicImports: number;
  importsByLanguage: Record<string, number>;
  exportsByLanguage: Record<string, number>;
} {
  let totalImports = 0;
  let totalExports = 0;
  let modulesWithImports = 0;
  let modulesWithExports = 0;
  let cyclicImports = 0;
  const importsByLanguage: Record<string, number> = {};
  const exportsByLanguage: Record<string, number> = {};

  // Используем graphData для анализа циклических импортов
  const cyclicEdges = graphData?.cyclicEdges || [];

  // Используем packages для статистики по языкам
  const moduleLanguages: Record<string, string> = {};
  if (packages) {
    for (const [modulePath, pkg] of Object.entries(packages)) {
      moduleLanguages[modulePath] = pkg.language || 'unknown';
    }
  }

  for (const modulePath of Object.keys(importsFlow)) {
    const imports = importsFlow[modulePath]?.importsFrom || [];
    const language = moduleLanguages[modulePath] || 'unknown';

    if (imports.length > 0) {
      modulesWithImports++;
      totalImports += imports.length;
      importsByLanguage[language] = (importsByLanguage[language] || 0) + imports.length;

      // Проверяем, есть ли циклические импорты
      for (const imp of imports) {
        if (cyclicEdges.some(edge => edge.includes(modulePath) && edge.includes(imp.module))) {
          cyclicImports++;
        }
      }
    }

    const exports = exportsFlow[modulePath]?.exportsTo || [];
    if (exports.length > 0) {
      modulesWithExports++;
      totalExports += exports.length;
      exportsByLanguage[language] = (exportsByLanguage[language] || 0) + exports.length;
    }
  }

  const totalModules = Object.keys(importsFlow).length || 1;

  return {
    totalImports,
    totalExports,
    modulesWithImports,
    modulesWithExports,
    avgImportsPerModule: totalImports / totalModules,
    avgExportsPerModule: totalExports / totalModules,
    cyclicImports,
    importsByLanguage,
    exportsByLanguage,
  };
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default {
  buildExecutionGraph,
  buildImportExportFlow,
  buildAsyncExecutionGraph,
  findEntryFunctions,
  hasCyclicImports,
  getImportExportStats,
};
