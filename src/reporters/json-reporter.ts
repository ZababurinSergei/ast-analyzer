// src/reporters/json-reporter.ts
import fs from 'fs';
import path from 'path';
import type { EntitiesResult } from '../core/entity-extractor.js';

export interface ModuleNode {
  id: string;
  name: string;
  type: 'module' | 'component' | 'vue';
  level: number;
  metadata: {
    size: number;
    lines: number;
    language: string;
    isEntry: boolean;
  };
}

export interface ModuleEdge {
  from: string;
  to: string;
  type: 'import' | 'external' | 're-export';
  specifiers: string[];
}

export interface ModuleGraph {
  nodes: ModuleNode[];
  edges: ModuleEdge[];
}

export interface EntityNode {
  id: string;
  name: string;
  type: 'function' | 'class' | 'constant' | 'interface' | 'type' | 'variable';
  module: string;
  line: number;
  metadata: Record<string, any>;
}

export interface EntityEdge {
  from: string;
  to: string;
  type:
    | 'function_call'
    | 'constant_reference'
    | 'class_extends'
    | 'class_implements'
    | 'interface_extends'
    | 'type_reference'
    | 'method_call'
    | 'property_access'
    | 'import_binding'
    | 'export_binding'
    | 'parameter_type'
    | 'return_type';
  line?: number;
}

export interface EntityGraph {
  nodes: EntityNode[];
  edges: EntityEdge[];
}

export interface FullAnalysis {
  version: string;
  root: string;
  timestamp: string;
  stats: {
    totalModules: number;
    totalEntities: number;
    hasCycles: boolean;
    cycles: string[][];
  };
  moduleGraph: ModuleGraph;
  entityGraph: EntityGraph;
}

export interface GraphData {
  rootKey: string;
  graph: Record<string, string[]>;
  hasCycles?: boolean;
  cyclicEdges?: string[];
}

// ==========================================
// НОВЫЕ ТИПЫ: ПАКЕТ-LOCK ФОРМАТ
// ==========================================

export interface PackageLockFunctionInfo {
  isAsync: boolean;
  isExported: boolean;
  params: string[];
  line: number;
  direction?: 'inward' | 'outward' | 'self';
  calls?: {
    target: string;
    direction: 'inward' | 'outward' | 'self';
    isAsync: boolean;
    line?: number;
  }[];
  consumers?: {
    module: string;
    direction: 'outward';
    type: 'import' | 'call';
  }[];
}

export interface PackageLockPackage {
  version: string;
  resolved: string;
  type: 'module' | 'commonjs';
  language: 'typescript' | 'javascript' | 'vue' | 'jsx';
  isEntry: boolean;
  imports: Record<
    string,
    {
      direction: 'inward';
      type: 'import' | 'external-import' | 'internal-import';
      specifiers: string[];
      functions: Record<string, PackageLockFunctionInfo>;
    }
  >;
  exports: Record<
    string,
    {
      direction: 'outward';
      type: 'export';
      isAsync: boolean;
      params: string[];
      returns: string;
      line: number;
      consumers: {
        module: string;
        direction: 'outward';
        type: 'import' | 'call';
      }[];
    }
  >;
}

export interface CallGraphResult {
  from: string;
  to: string;
  path: string[];
  found: boolean;
  reason?: string;
  nodes: {
    function: string;
    module: string;
    line: number;
    isAsync: boolean;
  }[];
  edges: {
    from: string;
    to: string;
    line?: number;
  }[];
}

export interface PackageLockReport {
  name: string;
  version: string;
  lockfileVersion: number;
  packages: Record<string, PackageLockPackage>;
  dependencyGraph: {
    direction: 'bidirectional';
    inwardDependencies: Record<string, string[]>;
    outwardDependencies: Record<string, string[]>;
  };
  executionGraph: {
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
  };
  importExportFlow: {
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
  };
  callGraph?: CallGraphResult;
}

// ==========================================
// СУЩЕСТВУЮЩИЕ ФУНКЦИИ
// ==========================================

/**
 * Сохраняет граф модулей в JSON
 */
export function saveModuleGraph(
  data: GraphData,
  entities: EntitiesResult,
  outputPath: string
): void {
  const moduleGraph = buildModuleGraph(data, entities);
  const json = JSON.stringify(moduleGraph, null, 2);
  fs.writeFileSync(outputPath, json, 'utf-8');
}

/**
 * Сохраняет граф сущностей в JSON
 */
export function saveEntityGraph(
  data: GraphData,
  entities: EntitiesResult,
  outputPath: string
): void {
  const entityGraph = buildEntityGraph(data, entities);
  const json = JSON.stringify(entityGraph, null, 2);
  fs.writeFileSync(outputPath, json, 'utf-8');
}

/**
 * Сохраняет полный анализ в JSON
 */
export function saveFullAnalysis(
  data: GraphData,
  entities: EntitiesResult,
  outputPath: string,
  root: string
): void {
  const fullAnalysis = buildFullAnalysis(data, entities, root);
  const json = JSON.stringify(fullAnalysis, null, 2);
  fs.writeFileSync(outputPath, json, 'utf-8');
}

/**
 * Сохраняет отчет в стиле package-lock.json
 */
export function savePackageLockReport(report: PackageLockReport, outputPath: string): void {
  const json = JSON.stringify(report, null, 2);
  fs.writeFileSync(outputPath, json, 'utf-8');
}

/**
 * Сохраняет результат графа вызовов между функциями
 */
export function saveCallGraphResult(callGraphResult: CallGraphResult, outputPath: string): void {
  const json = JSON.stringify(callGraphResult, null, 2);
  fs.writeFileSync(outputPath, json, 'utf-8');
}

// ==========================================
// ПОСТРОЕНИЕ ГРАФОВ (СУЩЕСТВУЮЩИЕ)
// ==========================================

/**
 * Строит граф модулей
 */
export function buildModuleGraph(data: GraphData, entities: EntitiesResult): ModuleGraph {
  const nodes: ModuleNode[] = [];
  const edges: ModuleEdge[] = [];

  const allModules = new Set<string>();
  allModules.add(data.rootKey);

  for (const [key, deps] of Object.entries(data.graph)) {
    allModules.add(key);
    for (const dep of deps) {
      allModules.add(dep);
    }
  }

  // Строим узлы
  for (const modulePath of allModules) {
    const isEntry = modulePath === data.rootKey;

    let language = 'javascript';
    if (modulePath.endsWith('.ts') || modulePath.endsWith('.tsx')) language = 'typescript';
    else if (modulePath.endsWith('.vue')) language = 'vue';
    else if (modulePath.endsWith('.jsx')) language = 'jsx';

    let size = 0;
    let lines = 0;
    try {
      const absPath = path.resolve(modulePath);
      if (fs.existsSync(absPath) && fs.statSync(absPath).isFile()) {
        const content = fs.readFileSync(absPath, 'utf-8');
        size = content.length;
        lines = content.split('\n').length;
      }
    } catch {
      // Игнорируем ошибки
    }

    const moduleNode: ModuleNode = {
      id: modulePath,
      name: path.basename(modulePath),
      type: modulePath.endsWith('.vue') ? 'vue' : 'module',
      level: modulePath === data.rootKey ? 0 : 1,
      metadata: {
        size,
        lines,
        language,
        isEntry,
      },
    };

    nodes.push(moduleNode);
  }

  // Строим ребра
  for (const [from, deps] of Object.entries(data.graph)) {
    for (const to of deps) {
      const isExternal = to.startsWith('@') || to.includes('/');

      const specifiers: string[] = [];
      const moduleEntity = entities.functions.filter(f => f.isExported);
      for (const entity of moduleEntity) {
        if (to.includes(entity.name) || entity.name.includes(to)) {
          specifiers.push(entity.name);
        }
      }

      edges.push({
        from,
        to,
        type: isExternal ? 'external' : 'import',
        specifiers:
          specifiers.length > 0 ? specifiers : [path.basename(to).replace(/\.[^.]+$/, '')],
      });
    }
  }

  return { nodes, edges };
}

/**
 * Строит граф сущностей с правильными связями между функциями
 * ✅ ИСПРАВЛЕНО: добавляем ребра для вызовов функций
 * ✅ ДОБАВЛЕНО: поиск модулей для вызываемых функций
 */
export function buildEntityGraph(data: GraphData, entities: EntitiesResult): EntityGraph {
  const nodes: EntityNode[] = [];
  const edges: EntityEdge[] = [];

  // === ФУНКЦИИ ===
  for (const func of entities.functions) {
    const modulePath = findModuleForEntity(func.name, data);
    const nodeId = modulePath ? `${modulePath}#${func.name}` : `#${func.name}`;

    // ✅ Убеждаемся, что calls это массив
    const calls = Array.isArray(func.calls) ? func.calls : [];

    nodes.push({
      id: nodeId,
      name: func.name,
      type: 'function',
      module: modulePath || 'unknown',
      line: func.line,
      metadata: {
        isAsync: func.isAsync,
        isExported: func.isExported,
        params: func.params,
        returnType: func.returnType,
        isMethod: func.isMethod,
        className: func.className,
        calls: calls,
        calledBy: func.calledBy || [],
        startLine: func.startLine,
        endLine: func.endLine,
        // Добавляем информацию об импорте, если функция из другого модуля
        importedFrom: modulePath !== data.rootKey ? modulePath : undefined,
      },
    });

    // ✅ Добавляем ребра для каждого вызова функции
    for (const call of calls) {
      // Ищем модуль для вызываемой функции
      let targetModule = findModuleForEntity(call, data);

      // Если не нашли по точному имени, ищем по частичному совпадению
      if (!targetModule) {
        for (const [modPath, deps] of Object.entries(data.graph)) {
          if (modPath.includes(call) || deps.some(d => d.includes(call))) {
            targetModule = modPath;
            break;
          }
        }
      }

      const targetId = targetModule ? `${targetModule}#${call}` : `#${call}`;

      edges.push({
        from: nodeId,
        to: targetId,
        type: 'function_call',
        line: func.line,
      });
    }
  }

  // === КЛАССЫ ===
  for (const cls of entities.classes) {
    const modulePath = findModuleForEntity(cls.name, data);
    const nodeId = modulePath ? `${modulePath}#${cls.name}` : `#${cls.name}`;

    nodes.push({
      id: nodeId,
      name: cls.name,
      type: 'class',
      module: modulePath || 'unknown',
      line: cls.line,
      metadata: {
        isExported: cls.isExported,
        methods: cls.methods,
        properties: cls.properties,
        extends: cls.extends,
        implements: cls.implements,
        startLine: cls.startLine,
        endLine: cls.endLine,
      },
    });

    if (cls.extends) {
      const targetModule = findModuleForEntity(cls.extends, data);
      const targetId = targetModule ? `${targetModule}#${cls.extends}` : `#${cls.extends}`;
      edges.push({
        from: nodeId,
        to: targetId,
        type: 'class_extends',
      });
    }

    for (const impl of cls.implements || []) {
      const targetModule = findModuleForEntity(impl, data);
      const targetId = targetModule ? `${targetModule}#${impl}` : `#${impl}`;
      edges.push({
        from: nodeId,
        to: targetId,
        type: 'class_implements',
      });
    }

    // Добавляем методы класса как отдельные узлы
    for (const method of cls.methods) {
      const methodId = `${modulePath || 'unknown'}#${method}`;
      // Проверяем, есть ли уже такой узел
      const exists = nodes.some(n => n.id === methodId);
      if (!exists) {
        nodes.push({
          id: methodId,
          name: method,
          type: 'function',
          module: modulePath || 'unknown',
          line: cls.line,
          metadata: {
            isExported: false,
            isAsync: false,
            params: [],
            isMethod: true,
            className: cls.name,
          },
        });
      }
      edges.push({
        from: nodeId,
        to: methodId,
        type: 'method_call',
      });
    }
  }

  // === КОНСТАНТЫ ===
  for (const constant of entities.constants) {
    const modulePath = findModuleForEntity(constant.name, data);
    const nodeId = modulePath ? `${modulePath}#${constant.name}` : `#${constant.name}`;

    nodes.push({
      id: nodeId,
      name: constant.name,
      type: 'constant',
      module: modulePath || 'unknown',
      line: constant.line,
      metadata: {
        value: constant.value,
        isExported: constant.isExported,
        type: constant.type,
      },
    });
  }

  // === ИНТЕРФЕЙСЫ ===
  for (const intf of entities.interfaces) {
    const modulePath = findModuleForEntity(intf.name, data);
    const nodeId = modulePath ? `${modulePath}#${intf.name}` : `#${intf.name}`;

    nodes.push({
      id: nodeId,
      name: intf.name,
      type: 'interface',
      module: modulePath || 'unknown',
      line: intf.line,
      metadata: {
        isExported: intf.isExported,
        properties: intf.properties,
        extends: intf.extends,
        startLine: intf.startLine,
        endLine: intf.endLine,
      },
    });

    for (const ext of intf.extends || []) {
      const targetModule = findModuleForEntity(ext, data);
      const targetId = targetModule ? `${targetModule}#${ext}` : `#${ext}`;
      edges.push({
        from: nodeId,
        to: targetId,
        type: 'interface_extends',
      });
    }
  }

  // === ТИПЫ ===
  for (const type of entities.types) {
    const modulePath = findModuleForEntity(type.name, data);
    const nodeId = modulePath ? `${modulePath}#${type.name}` : `#${type.name}`;

    nodes.push({
      id: nodeId,
      name: type.name,
      type: 'type',
      module: modulePath || 'unknown',
      line: type.line,
      metadata: {
        isExported: type.isExported,
        definition: type.definition,
      },
    });
  }

  // === ПЕРЕМЕННЫЕ ===
  for (const variable of entities.variables) {
    const modulePath = findModuleForEntity(variable.name, data);
    const nodeId = modulePath ? `${modulePath}#${variable.name}` : `#${variable.name}`;

    nodes.push({
      id: nodeId,
      name: variable.name,
      type: 'variable',
      module: modulePath || 'unknown',
      line: variable.line,
      metadata: {
        isExported: variable.isExported,
        type: variable.type,
        value: variable.value,
      },
    });
  }

  // ✅ ДОПОЛНИТЕЛЬНО: добавляем ребра для импортов и экспортов
  // Импорты: для каждого импорта добавляем связь
  for (const imp of entities.imports) {
    const sourceModule = imp.source;
    const currentModule = entities.moduleName;

    // Находим модуль-источник
    let fromModule = findModuleForEntity(currentModule, data);
    let toModule = findModuleForEntity(sourceModule, data);

    if (fromModule && toModule) {
      for (const spec of imp.specifiers) {
        const fromId = `${fromModule}#${currentModule}`;
        const toId = `${toModule}#${spec}`;
        // Добавляем ребро импорта
        edges.push({
          from: fromId,
          to: toId,
          type: 'import_binding',
        });
      }
    }
  }

  return { nodes, edges };
}

/**
 * Строит полный анализ
 */
export function buildFullAnalysis(
  data: GraphData,
  entities: EntitiesResult,
  root: string
): FullAnalysis {
  const allEntities =
    entities.functions.length +
    entities.classes.length +
    entities.constants.length +
    entities.interfaces.length +
    entities.types.length +
    entities.variables.length;

  const cycles = data.cyclicEdges?.map(edge => edge.split('->')) || [];

  return {
    version: '3.0.0',
    root,
    timestamp: new Date().toISOString(),
    stats: {
      totalModules: Object.keys(data.graph).length,
      totalEntities: allEntities,
      hasCycles: data.hasCycles || false,
      cycles,
    },
    moduleGraph: buildModuleGraph(data, entities),
    entityGraph: buildEntityGraph(data, entities),
  };
}

// ==========================================
// НОВАЯ ФУНКЦИЯ: ПОСТРОЕНИЕ ОТЧЕТА В СТИЛЕ PACKAGE-LOCK
// ==========================================

/**
 * Строит отчет в стиле package-lock.json из данных графа и сущностей
 */
export function buildPackageLockReport(
  rootKey: string,
  graph: Record<string, string[]>,
  entitiesMap: Record<string, EntitiesResult>
): PackageLockReport {
  const packages: Record<string, PackageLockPackage> = {};
  const inwardDeps: Record<string, string[]> = {};
  const outwardDeps: Record<string, string[]> = {};
  const importsFlow: PackageLockReport['importExportFlow']['imports'] = {};
  const exportsFlow: PackageLockReport['importExportFlow']['exports'] = {};

  // Инициализируем
  for (const modulePath of Object.keys(graph)) {
    inwardDeps[modulePath] = [];
    outwardDeps[modulePath] = [];
    importsFlow[modulePath] = { importsFrom: [] };
    exportsFlow[modulePath] = { exportsTo: [] };
  }

  // Строим граф зависимостей
  for (const [from, deps] of Object.entries(graph)) {
    for (const dep of deps) {
      if (inwardDeps[from]) {
        inwardDeps[from].push(dep);
      }
      if (outwardDeps[dep]) {
        outwardDeps[dep].push(from);
      }
    }
  }

  // Строим пакеты
  for (const [modulePath, entities] of Object.entries(entitiesMap)) {
    const isEntry = modulePath === rootKey;
    const ext = path.extname(modulePath);
    let language: PackageLockPackage['language'] = 'typescript';
    if (ext === '.js' || ext === '.jsx') language = 'javascript';
    else if (ext === '.vue') language = 'vue';
    else if (ext === '.tsx') language = 'jsx';

    // Строим imports
    const imports: PackageLockPackage['imports'] = {};
    for (const imp of entities.imports) {
      const importKey = imp.source;
      imports[importKey] = {
        direction: 'inward',
        type: imp.source.startsWith('.') ? 'internal-import' : 'external-import',
        specifiers: imp.specifiers,
        functions: {},
      };

      // Добавляем импортируемые функции
      for (const spec of imp.specifiers) {
        const funcName = spec.replace(/ as .*$/, '');
        const func = entities.functions.find(f => f.name === funcName);
        if (func) {
          imports[importKey].functions[funcName] = {
            isAsync: func.isAsync,
            isExported: func.isExported,
            params: func.params,
            line: func.line,
            direction: 'inward',
            calls: func.calls.map(call => ({
              target: call,
              direction: 'inward',
              isAsync: false,
            })),
          };
        }
      }
    }

    // Строим exports
    const exports: PackageLockPackage['exports'] = {};

    // Сначала добавляем все экспорты
    for (const func of entities.functions) {
      if (func.isExported) {
        exports[func.name] = {
          direction: 'outward',
          type: 'export',
          isAsync: func.isAsync,
          params: func.params,
          returns: func.returnType || 'any',
          line: func.line,
          consumers: [],
        };
      }
    }

    // Затем добавляем потребителей для каждого экспорта
    for (const func of entities.functions) {
      if (func.isExported) {
        const exportEntry = exports[func.name];
        if (!exportEntry) continue;

        // Находим модули, которые вызывают эту функцию
        for (const [otherModule, otherEntities] of Object.entries(entitiesMap)) {
          if (otherModule === modulePath) continue;
          for (const otherFunc of otherEntities.functions) {
            if (otherFunc.calls && otherFunc.calls.includes(func.name)) {
              exportEntry.consumers.push({
                module: otherModule,
                direction: 'outward',
                type: 'call',
              });
            }
          }
        }
      }
    }

    // Добавляем поток импортов
    for (const imp of entities.imports) {
      const impSource = imp.source;
      if (!importsFlow[modulePath]) {
        importsFlow[modulePath] = { importsFrom: [] };
      }
      const firstSpec = imp.specifiers[0];
      importsFlow[modulePath].importsFrom.push({
        module: impSource,
        type: firstSpec && firstSpec.includes('default') ? 'default' : 'named',
        imports: imp.specifiers,
      });
    }

    // Добавляем поток экспортов
    for (const func of entities.functions) {
      if (func.isExported) {
        const consumers: { module: string; type: 'named' | 'default'; exports: string[] }[] = [];
        for (const [otherModule, otherEntities] of Object.entries(entitiesMap)) {
          if (otherModule === modulePath) continue;
          for (const otherFunc of otherEntities.functions) {
            if (otherFunc.calls && otherFunc.calls.includes(func.name)) {
              consumers.push({
                module: otherModule,
                type: 'named',
                exports: [func.name],
              });
            }
          }
        }
        if (consumers.length > 0) {
          if (!exportsFlow[modulePath]) {
            exportsFlow[modulePath] = { exportsTo: [] };
          }
          for (const consumer of consumers) {
            exportsFlow[modulePath].exportsTo.push(consumer);
          }
        }
      }
    }

    packages[modulePath] = {
      version: '1.0.0',
      resolved: `file:${modulePath}`,
      type: 'module',
      language,
      isEntry,
      imports,
      exports,
    };
  }

  // Находим entry функции
  const entryFunctions: string[] = [];
  const rootEntities = entitiesMap[rootKey];
  if (rootEntities) {
    for (const func of rootEntities.functions) {
      if (func.isExported) {
        entryFunctions.push(func.name);
      }
    }
  }

  // Строим executionFlow
  const executionSteps: PackageLockReport['executionGraph']['executionFlow']['steps'] = [];
  if (rootEntities) {
    for (const func of rootEntities.functions) {
      if (func.isExported) {
        executionSteps.push({
          func: func.name,
          module: rootKey,
          direction: 'self',
          isAsync: func.isAsync,
        });
      }
    }
  }

  return {
    name: 'ast-analyzer',
    version: '3.0.0',
    lockfileVersion: 3,
    packages,
    dependencyGraph: {
      direction: 'bidirectional',
      inwardDependencies: inwardDeps,
      outwardDependencies: outwardDeps,
    },
    executionGraph: {
      entryPoint: rootKey,
      direction: 'top-down',
      entryFunctions,
      executionFlow: {
        type: 'sequential',
        steps: executionSteps,
      },
    },
    importExportFlow: {
      imports: importsFlow,
      exports: exportsFlow,
    },
  };
}

// ==========================================
// НОВАЯ ФУНКЦИЯ: ПОСТРОЕНИЕ ГРАФА ВЫЗОВОВ МЕЖДУ ФУНКЦИЯМИ
// ==========================================

/**
 * Строит граф вызовов между двумя функциями с помощью BFS
 */
export function buildCallGraphBetweenFunctions(
  allFunctions: Map<string, { module: string; line: number; isAsync: boolean; calls: string[] }>,
  fromFunction: string,
  toFunction: string
): CallGraphResult {
  // Проверяем существование функций
  if (!allFunctions.has(fromFunction)) {
    return {
      from: fromFunction,
      to: toFunction,
      path: [],
      found: false,
      reason: `Начальная функция '${fromFunction}' не найдена в проекте`,
      nodes: [],
      edges: [],
    };
  }

  if (!allFunctions.has(toFunction)) {
    return {
      from: fromFunction,
      to: toFunction,
      path: [],
      found: false,
      reason: `Конечная функция '${toFunction}' не найдена в проекте`,
      nodes: [],
      edges: [],
    };
  }

  // BFS для поиска пути
  const visited = new Set<string>();
  const queue: { func: string; path: string[] }[] = [{ func: fromFunction, path: [fromFunction] }];
  const nodes: CallGraphResult['nodes'] = [];
  const edges: CallGraphResult['edges'] = [];

  while (queue.length > 0) {
    const { func, path } = queue.shift()!;

    if (visited.has(func)) continue;
    visited.add(func);

    // Добавляем узел
    const funcInfo = allFunctions.get(func);
    if (funcInfo) {
      nodes.push({
        function: func,
        module: funcInfo.module,
        line: funcInfo.line,
        isAsync: funcInfo.isAsync,
      });
    }

    // Если нашли целевую функцию
    if (func === toFunction) {
      // Добавляем ребра для пути
      for (let i = 0; i < path.length - 1; i++) {
        const from = path[i];
        const to = path[i + 1];
        if (from === undefined || to === undefined) continue;
        const fromInfo = allFunctions.get(from);
        edges.push({
          from,
          to,
          line: fromInfo ? fromInfo.line : undefined,
        });
      }

      return {
        from: fromFunction,
        to: toFunction,
        path,
        found: true,
        nodes,
        edges,
      };
    }

    // Добавляем вызовы
    const info = allFunctions.get(func);
    if (info) {
      for (const call of info.calls) {
        if (!visited.has(call) && allFunctions.has(call)) {
          queue.push({ func: call, path: [...path, call] });
        }
      }
    }
  }

  // Путь не найден - анализируем причину
  let reason = `Путь от '${fromFunction}' к '${toFunction}' не найден.`;

  // Проверяем, достижима ли конечная функция вообще
  const reachable = new Set<string>();
  const queueReach = [fromFunction];
  while (queueReach.length > 0) {
    const func = queueReach.shift()!;
    if (reachable.has(func)) continue;
    reachable.add(func);
    const info = allFunctions.get(func);
    if (info) {
      for (const call of info.calls) {
        if (allFunctions.has(call) && !reachable.has(call)) {
          queueReach.push(call);
        }
      }
    }
  }

  if (!reachable.has(toFunction)) {
    reason += ` Функция '${toFunction}' не достижима из '${fromFunction}'.`;
  }

  // Проверяем, нет ли цикла
  const cycleDetected = detectCycle(allFunctions, fromFunction);
  if (cycleDetected) {
    reason += ` Обнаружен цикл в графе вызовов.`;
  }

  // Добавляем доступные узлы
  for (const [funcName, info] of allFunctions) {
    if (reachable.has(funcName)) {
      nodes.push({
        function: funcName,
        module: info.module,
        line: info.line,
        isAsync: info.isAsync,
      });
    }
  }

  // Добавляем ребра для достижимых узлов
  for (const [from, info] of allFunctions) {
    if (reachable.has(from)) {
      for (const to of info.calls) {
        if (reachable.has(to) && allFunctions.has(to)) {
          edges.push({
            from,
            to,
            line: info.line,
          });
        }
      }
    }
  }

  return {
    from: fromFunction,
    to: toFunction,
    path: [],
    found: false,
    reason,
    nodes,
    edges,
  };
}

/**
 * Проверяет наличие цикла в графе вызовов
 */
function detectCycle(
  allFunctions: Map<string, { module: string; line: number; isAsync: boolean; calls: string[] }>,
  start: string
): boolean {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  const dfs = (func: string): boolean => {
    if (recursionStack.has(func)) return true;
    if (visited.has(func)) return false;

    visited.add(func);
    recursionStack.add(func);

    const info = allFunctions.get(func);
    if (info) {
      for (const call of info.calls) {
        if (allFunctions.has(call)) {
          if (dfs(call)) return true;
        }
      }
    }

    recursionStack.delete(func);
    return false;
  };

  return dfs(start);
}

// ==========================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ==========================================

/**
 * Находит модуль для сущности
 * ✅ УЛУЧШЕНО: поиск по частичному совпадению
 */
function findModuleForEntity(entityName: string, data: GraphData): string | null {
  // 1. Точное совпадение
  for (const [modulePath, deps] of Object.entries(data.graph)) {
    if (modulePath.includes(entityName)) {
      return modulePath;
    }
    for (const dep of deps) {
      if (dep.includes(entityName)) {
        return dep;
      }
    }
  }

  // 2. Частичное совпадение (если имя содержит расширение)
  const baseName = entityName.replace(/\.[^.]+$/, '');
  for (const [modulePath, deps] of Object.entries(data.graph)) {
    if (modulePath.includes(baseName)) {
      return modulePath;
    }
    for (const dep of deps) {
      if (dep.includes(baseName)) {
        return dep;
      }
    }
  }

  // 3. Поиск по имени файла (без пути)
  for (const [modulePath] of Object.entries(data.graph)) {
    const fileName = path.basename(modulePath).replace(/\.[^.]+$/, '');
    if (fileName === baseName || entityName.includes(fileName)) {
      return modulePath;
    }
  }

  return null;
}

// ==========================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ==========================================

export default {
  saveModuleGraph,
  saveEntityGraph,
  saveFullAnalysis,
  savePackageLockReport,
  saveCallGraphResult,
  buildModuleGraph,
  buildEntityGraph,
  buildFullAnalysis,
  buildPackageLockReport,
  buildCallGraphBetweenFunctions,
};
