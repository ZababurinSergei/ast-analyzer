// src/reporters/modules/packages.ts
// Данные по модулям/файлам

import fs from 'fs';
import path from 'path';
import {
  Project,
  Node,
  type SourceFile,
  type FunctionDeclaration,
  type ClassDeclaration,
} from 'ts-morph';
import { analyzeVueComponent } from '../../modes/vue-analyzer.js';
import {
  EnhancedPackageInfo,
  EntitiesResult,
  GraphData,
  EnhancedFunctionInfo,
  FunctionEntity,
  EnhancedClassInfo,
} from './types.js';
import {
  safeString,
  safeNumber,
  safeBoolean,
  ensureArray,
  findFileInProject,
  findModuleForEntity,
} from './utils.js';
import { convertToEnhancedEntityInfo, buildConsumersMap } from './converters.js';

// ============================================================
// ТИПЫ ДЛЯ РАБОТЫ С TS-MORPH
// ============================================================

/**
 * Результат анализа файла с помощью ts-morph
 */
interface TsMorphAnalysisResult {
  functions: EnhancedFunctionInfo[];
  classes: EnhancedClassInfo[];
  imports: EnhancedPackageInfo['imports'];
  sourceFile: SourceFile | null;
  diagnostics: string[];
}

/**
 * Информация о функции для построения графа
 */
interface FunctionNodeInfo {
  name: string;
  module: string;
  line: number;
  isExported: boolean;
  calls: string[];
  calledBy: string[];
}

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

/**
 * Строит карту всех функций из всех модулей для быстрого поиска
 */
function buildFunctionMap(
  entitiesMap: Record<string, EntitiesResult>,
  graphData?: GraphData
): Map<string, { module: string; line: number; name: string; isExported: boolean }> {
  const functionMap = new Map<
    string,
    { module: string; line: number; name: string; isExported: boolean }
  >();

  for (const [modulePath, entities] of Object.entries(entitiesMap)) {
    if (!entities) continue;
    const functions = ensureArray<any>(entities.functions) as FunctionEntity[];
    for (const func of functions) {
      const funcName = safeString(func.name);
      if (funcName) {
        const moduleForFunc = graphData ? findModuleForEntity(funcName, graphData) : null;

        functionMap.set(funcName, {
          module: moduleForFunc || modulePath,
          line: safeNumber(func.line),
          name: funcName,
          isExported: safeBoolean(func.isExported),
        });
      }
    }
  }

  return functionMap;
}

/**
 * Использует functionMap для быстрого поиска информации о функции
 */
function findFunctionInfo(
  functionMap: Map<string, { module: string; line: number; name: string; isExported: boolean }>,
  functionName: string
): { module: string; line: number; name: string; isExported: boolean } | undefined {
  return functionMap.get(functionName);
}

/**
 * Проверяет, существует ли функция в карте
 */
function functionExistsInMap(
  functionMap: Map<string, { module: string; line: number; name: string; isExported: boolean }>,
  functionName: string
): boolean {
  return functionMap.has(functionName);
}

/**
 * Строит полный граф вызовов между функциями
 */
function buildCallGraph(
  entitiesMap: Record<string, EntitiesResult>,
  graphData?: GraphData
): Map<string, FunctionNodeInfo> {
  const callGraph = new Map<string, FunctionNodeInfo>();

  // Сначала собираем все функции
  for (const [modulePath, entities] of Object.entries(entitiesMap)) {
    if (!entities) continue;
    const functions = ensureArray<any>(entities.functions) as FunctionEntity[];
    for (const func of functions) {
      const funcName = safeString(func.name);
      if (!funcName) continue;

      const moduleForFunc = graphData ? findModuleForEntity(funcName, graphData) : modulePath;

      callGraph.set(funcName, {
        name: funcName,
        module: moduleForFunc || modulePath,
        line: safeNumber(func.line),
        isExported: safeBoolean(func.isExported),
        calls: ensureArray<string>(func.calls || []),
        calledBy: [],
      });
    }
  }

  // Затем заполняем calledBy
  for (const [funcName, info] of callGraph) {
    for (const call of info.calls) {
      const calledInfo = callGraph.get(call);
      if (calledInfo && calledInfo.name !== funcName) {
        const moduleForCaller = graphData ? findModuleForEntity(funcName, graphData) : info.module;
        if (moduleForCaller) {
          calledInfo.calledBy.push(funcName);
        }
      }
    }
  }

  return callGraph;
}

/**
 * Находит все функции, которые используют экспорт
 */
function findConsumersForExport(
  exportName: string,
  callGraph: Map<string, FunctionNodeInfo>,
  graphData?: GraphData
): { function: string; module: string; line: number }[] {
  const consumers: { function: string; module: string; line: number }[] = [];

  for (const [funcName, info] of callGraph) {
    if (info.calls.includes(exportName) && funcName !== exportName) {
      const moduleForFunc = graphData ? findModuleForEntity(funcName, graphData) : info.module;
      if (moduleForFunc) {
        consumers.push({
          function: funcName,
          module: moduleForFunc,
          line: info.line,
        });
      }
    }
  }

  return consumers;
}

/**
 * Находит все экспорты, которые используются в модуле
 */
function findExportsUsedInModule(
  modulePath: string,
  entities: EntitiesResult,
  callGraph: Map<string, FunctionNodeInfo>,
  graphData?: GraphData
): string[] {
  const usedExports: string[] = [];
  const functions = ensureArray<any>(entities.functions) as FunctionEntity[];

  const moduleExists = graphData ? findModuleForEntity(modulePath, graphData) !== null : true;
  if (!moduleExists) return usedExports;

  for (const func of functions) {
    const funcName = safeString(func.name);
    if (!funcName) continue;

    const funcInfo = callGraph.get(funcName);
    if (!funcInfo) continue;

    const calls = funcInfo.calls || [];

    for (const call of calls) {
      const moduleForCall = graphData ? findModuleForEntity(call, graphData) : null;
      if (moduleForCall) {
        const calledFuncInfo = callGraph.get(call);
        if (calledFuncInfo && calledFuncInfo.isExported) {
          usedExports.push(call);
        }
      }
    }
  }

  return [...new Set(usedExports)];
}

/**
 * Проверяет, есть ли циклические зависимости в графе
 */
function hasCyclicDependencies(graphData: GraphData): boolean {
  if (!graphData.graph) return false;

  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  const dfs = (node: string): boolean => {
    if (recursionStack.has(node)) return true;
    if (visited.has(node)) return false;

    visited.add(node);
    recursionStack.add(node);

    const neighbors = graphData.graph[node] || [];
    for (const neighbor of neighbors) {
      const neighborExists = findModuleForEntity(neighbor, graphData) !== null;
      if (neighborExists && dfs(neighbor)) {
        return true;
      }
    }

    recursionStack.delete(node);
    return false;
  };

  for (const node of Object.keys(graphData.graph)) {
    if (dfs(node)) {
      return true;
    }
  }

  return false;
}

/**
 * Находит все циклические ребра в графе
 */
function findCyclicEdges(graphData: GraphData): string[] {
  if (!graphData.graph) return [];

  const cycles: string[] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const path: string[] = [];

  const dfs = (node: string): void => {
    if (recursionStack.has(node)) {
      const cycleStart = path.indexOf(node);
      if (cycleStart !== -1) {
        const cyclePath = path.slice(cycleStart);
        if (cyclePath.length > 1) {
          const allExist = cyclePath.every(n => findModuleForEntity(n, graphData) !== null);
          if (allExist) {
            cycles.push(`${cyclePath.join(' → ')}`);
          }
        }
      }
      return;
    }

    if (visited.has(node)) return;

    visited.add(node);
    recursionStack.add(node);
    path.push(node);

    const neighbors = graphData.graph[node] || [];
    for (const neighbor of neighbors) {
      if (findModuleForEntity(neighbor, graphData) !== null) {
        dfs(neighbor);
      }
    }

    recursionStack.delete(node);
    path.pop();
  };

  for (const node of Object.keys(graphData.graph)) {
    if (!visited.has(node)) {
      dfs(node);
    }
  }

  return cycles;
}

/**
 * Получает максимальную глубину графа
 */
function getGraphMaxDepth(graphData: GraphData): number {
  if (!graphData.graph || Object.keys(graphData.graph).length === 0) return 0;

  let maxDepth = 0;
  const visited = new Set<string>();

  const dfs = (node: string, depth: number): void => {
    if (visited.has(node)) return;
    visited.add(node);
    maxDepth = Math.max(maxDepth, depth);

    const neighbors = graphData.graph[node] || [];
    for (const neighbor of neighbors) {
      if (findModuleForEntity(neighbor, graphData) !== null) {
        dfs(neighbor, depth + 1);
      }
    }
  };

  const called = new Set<string>();
  for (const deps of Object.values(graphData.graph)) {
    for (const dep of deps) {
      if (findModuleForEntity(dep, graphData) !== null) {
        called.add(dep);
      }
    }
  }

  const roots = Object.keys(graphData.graph).filter(
    node => !called.has(node) && findModuleForEntity(node, graphData) !== null
  );

  if (roots.length === 0) {
    for (const node of Object.keys(graphData.graph)) {
      if (!visited.has(node) && findModuleForEntity(node, graphData) !== null) {
        dfs(node, 0);
      }
    }
  } else {
    for (const root of roots) {
      visited.clear();
      dfs(root, 0);
    }
  }

  return maxDepth;
}

/**
 * Получает количество модулей на каждом уровне графа
 */
function getModulesByLevelFromGraph(graphData: GraphData): Record<number, string[]> {
  if (!graphData.graph || Object.keys(graphData.graph).length === 0) return {};

  const modulesByLevel: Record<number, string[]> = {};
  const visited = new Set<string>();
  const queue: { node: string; level: number }[] = [];

  const called = new Set<string>();
  for (const deps of Object.values(graphData.graph)) {
    for (const dep of deps) {
      if (findModuleForEntity(dep, graphData) !== null) {
        called.add(dep);
      }
    }
  }

  const roots = Object.keys(graphData.graph).filter(
    node => !called.has(node) && findModuleForEntity(node, graphData) !== null
  );

  if (roots.length === 0) {
    for (const node of Object.keys(graphData.graph)) {
      if (findModuleForEntity(node, graphData) !== null) {
        queue.push({ node, level: 0 });
      }
    }
  } else {
    for (const root of roots) {
      queue.push({ node: root, level: 0 });
    }
  }

  while (queue.length > 0) {
    const { node, level } = queue.shift()!;
    if (visited.has(node)) continue;
    visited.add(node);

    if (!modulesByLevel[level]) {
      modulesByLevel[level] = [];
    }
    modulesByLevel[level].push(node);

    const deps = graphData.graph[node] || [];
    for (const dep of deps) {
      if (!visited.has(dep) && findModuleForEntity(dep, graphData) !== null) {
        queue.push({ node: dep, level: level + 1 });
      }
    }
  }

  return modulesByLevel;
}

/**
 * Получает информацию о структуре графа
 */
function getGraphStructureInfo(graphData: GraphData): {
  hasCycles: boolean;
  cyclicEdges: string[];
  maxDepth: number;
  modulesByLevel: Record<number, string[]>;
  isAcyclic: boolean;
  totalModules: number;
  validModules: string[];
  invalidModules: string[];
} {
  const hasCycles = hasCyclicDependencies(graphData);
  const cyclicEdges = findCyclicEdges(graphData);
  const maxDepth = getGraphMaxDepth(graphData);
  const modulesByLevel = getModulesByLevelFromGraph(graphData);
  const isAcyclic = !hasCycles;
  const totalModules = Object.keys(graphData.graph || {}).length;

  const validModules: string[] = [];
  const invalidModules: string[] = [];

  for (const modulePath of Object.keys(graphData.graph)) {
    const foundModule = findModuleForEntity(modulePath, graphData);
    if (foundModule) {
      validModules.push(modulePath);
    } else {
      invalidModules.push(modulePath);
    }
  }

  return {
    hasCycles,
    cyclicEdges,
    maxDepth,
    modulesByLevel,
    isAcyclic,
    totalModules,
    validModules,
    invalidModules,
  };
}

/**
 * Создает пустой пакет для модуля
 */
function createEmptyPackage(modulePath: string, relativePath: string): EnhancedPackageInfo {
  return {
    version: '1.0.0',
    resolved: `file:${modulePath}`,
    displayPath: relativePath,
    type: 'module',
    language: 'typescript',
    isEntry: false,
    imports: {},
    exports: {},
    entities: {
      functions: [],
      constants: [],
      variables: [],
      interfaces: [],
      types: [],
      classes: [],
    },
    fileStats: {
      size: 0,
      lines: 0,
      functions: 0,
      classes: 0,
      constants: 0,
      interfaces: 0,
      types: 0,
      variables: 0,
    },
  };
}

/**
 * Строит импорты для модуля
 * ✅ СОХРАНЯЕТ ВСЕ specifiers
 */
function buildImports(
  entities: EntitiesResult,
  entitiesMap: Record<string, EntitiesResult>,
  graphData?: GraphData
): EnhancedPackageInfo['imports'] {
  const imports: EnhancedPackageInfo['imports'] = {};

  if (!entities.imports) return imports;

  const importList = ensureArray<any>(entities.imports);
  for (const imp of importList) {
    const source = safeString(imp.source);
    if (!source) continue;

    // Определяем, является ли импорт внутренним
    let isInternal = Object.keys(entitiesMap).some(p => p.includes(source) || source.includes(p));

    if (!isInternal && graphData) {
      const foundModule = findModuleForEntity(source, graphData);
      if (foundModule) {
        isInternal = true;
      }
    }

    const isExternal = !isInternal && !source.startsWith('.');

    // ✅ СОХРАНЯЕМ ВСЕ specifiers
    const specifiers = ensureArray<any>(imp.specifiers).map((s: any) => {
      if (typeof s === 'string') return s;
      return safeString(s.local || s.imported || s);
    });

    // ✅ СОХРАНЯЕМ isTypeOnly
    const isTypeOnly = imp.isTypeOnly || false;

    imports[source] = {
      direction: 'inward',
      type: isExternal ? 'external-import' : 'internal-import',
      specifiers: specifiers,
      functions: {},
      isTypeOnly: isTypeOnly,
      line: imp.line || 0,
    };

    // ✅ ЛОГИРУЕМ ИМПОРТЫ
    if (specifiers.length > 0) {
      console.log(`   📥 Импорт: ${source} → ${specifiers.join(', ')}`);
    }
  }

  return imports;
}

/**
 * Строит экспорты с consumers для модуля
 * ✅ СОХРАНЯЕТ ВСЕ ДАННЫЕ О ЭКСПОРТАХ
 */
function buildExports(
  entities: EntitiesResult,
  entitiesMap: Record<string, EntitiesResult>,
  graphData?: GraphData
): EnhancedPackageInfo['exports'] {
  const exports: EnhancedPackageInfo['exports'] = {};

  if (!entities.functions) return exports;

  const enhancedEntities = convertToEnhancedEntityInfo(entities);
  const allEnhancedFunctions: EnhancedFunctionInfo[] = [];

  for (const [_modulePath, moduleEntities] of Object.entries(entitiesMap)) {
    if (!moduleEntities) continue;
    const moduleEnhanced = convertToEnhancedEntityInfo(moduleEntities);
    allEnhancedFunctions.push(...moduleEnhanced.functions);
  }

  const graphDataForCallGraph = graphData
    ? {
        rootKey: graphData.rootKey,
        graph: graphData.graph,
      }
    : undefined;

  // Строим граф вызовов
  const callGraph = buildCallGraph(entitiesMap, graphDataForCallGraph);

  // Используем buildConsumersMap для построения карты consumers
  const consumersMap = buildConsumersMap(enhancedEntities.functions, allEnhancedFunctions);

  const functionList = ensureArray<any>(entities.functions) as FunctionEntity[];
  for (const func of functionList) {
    if (func.isExported) {
      const funcName = safeString(func.name);
      if (!funcName) continue;

      // Получаем consumers из карты
      const consumers = consumersMap.get(funcName) || [];

      // Дополнительно обогащаем consumers через граф вызовов
      const graphConsumers = findConsumersForExport(funcName, callGraph, graphDataForCallGraph);

      // Объединяем consumers из обоих источников
      const allConsumers = [...consumers, ...graphConsumers];
      const uniqueConsumers = allConsumers.filter(
        (c, index, self) =>
          index === self.findIndex(t => t.function === c.function && t.module === c.module)
      );

      // ✅ СОХРАНЯЕМ ВСЕ ДАННЫЕ ОБ ЭКСПОРТЕ
      exports[funcName] = {
        direction: 'outward',
        type: 'export',
        isAsync: func.isAsync || false,
        params: ensureArray<any>(func.params).map((p: any) => safeString(p)),
        returns: safeString(func.returnType || 'any'),
        line: safeNumber(func.line),
        consumers: uniqueConsumers,
      };

      // ✅ ЛОГИРУЕМ ЭКСПОРТ
      // if (uniqueConsumers.length > 0) {
        // console.log(`   📤 Экспорт ${funcName}: ${uniqueConsumers.length} потребителей`);
      // }
    }
  }

  return exports;
}

/**
 * Извлекает вызовы из тела функции с помощью ts-morph
 */
function extractCallsFromFunction(func: FunctionDeclaration, funcName: string): string[] {
  const calls: string[] = [];

  func.forEachDescendant((node: Node) => {
    if (Node.isCallExpression(node)) {
      const expr = node.getExpression();
      if (Node.isIdentifier(expr)) {
        const calledName = expr.getText();
        if (calledName && calledName !== funcName) {
          calls.push(calledName);
        }
      }
    }
  });

  return [...new Set(calls)];
}

/**
 * Вычисляет цикломатическую сложность функции с помощью ts-morph
 */
function calculateComplexity(func: FunctionDeclaration): number {
  let complexity = 1;

  func.forEachDescendant((node: Node) => {
    const kind = node.getKind();
    if (
      kind === 95 ||
      kind === 96 ||
      kind === 97 ||
      kind === 98 ||
      kind === 129 ||
      kind === 130 ||
      kind === 131 ||
      kind === 132
    ) {
      complexity++;
    }
  });

  return complexity;
}

/**
 * Извлекает информацию о безопасности из тела функции
 */
function extractSecurityInfo(func: FunctionDeclaration): EnhancedFunctionInfo['security'] {
  const bodyText = func.getBody()?.getText() || '';

  return {
    hasEval: bodyText.includes('eval(') || bodyText.includes('eval ('),
    hasProcessEnv: bodyText.includes('process.env'),
    hasSensitiveData:
      /['\"][a-zA-Z0-9_\-]{32,}['\"]/.test(bodyText) || /'"]sk-[a-zA-Z0-9]{20,}['"]/.test(bodyText),
    hasExec: bodyText.includes('exec(') || bodyText.includes('exec ('),
    hasPassword: /\b(password|passwd|pwd|secret|token|api[_-]?key)\b/i.test(bodyText),
  };
}

/**
 * Извлекает информацию о методах класса с помощью ts-morph
 */
function extractClassMethods(cls: ClassDeclaration): {
  methods: string[];
  methodDetails: EnhancedClassInfo['methodDetails'];
} {
  const methods: string[] = [];
  const methodDetails: EnhancedClassInfo['methodDetails'] = [];

  for (const method of cls.getMethods()) {
    const methodName = method.getName();
    if (methodName) {
      methods.push(methodName);
      methodDetails?.push({
        name: methodName,
        params: method.getParameters().map(p => p.getName()),
        returnType: method.getReturnType().getText(),
        isAsync: method.isAsync(),
        line: method.getStartLineNumber(),
      });
    }
  }

  return { methods, methodDetails };
}

/**
 * Извлекает информацию о свойствах класса с помощью ts-morph
 */
function extractClassProperties(cls: ClassDeclaration): {
  properties: string[];
  propertyDetails: EnhancedClassInfo['propertyDetails'];
} {
  const properties: string[] = [];
  const propertyDetails: EnhancedClassInfo['propertyDetails'] = [];

  for (const prop of cls.getProperties()) {
    const propName = prop.getName();
    if (propName) {
      properties.push(propName);
      propertyDetails?.push({
        name: propName,
        type: prop.getType().getText(),
        line: prop.getStartLineNumber(),
      });
    }
  }

  return { properties, propertyDetails };
}

/**
 * Извлекает импорты из SourceFile с помощью ts-morph
 */
function extractImportsFromSourceFile(sourceFile: SourceFile): EnhancedPackageInfo['imports'] {
  const imports: EnhancedPackageInfo['imports'] = {};
  const importDeclarations = sourceFile.getImportDeclarations();

  for (const imp of importDeclarations) {
    const moduleSpec = imp.getModuleSpecifierValue();
    if (!moduleSpec) continue;

    const specifiers: string[] = [];
    const namedImports = imp.getNamedImports();
    for (const named of namedImports) {
      specifiers.push(named.getName());
    }
    const defaultImport = imp.getDefaultImport();
    if (defaultImport) {
      specifiers.push(`default as ${defaultImport.getText()}`);
    }
    const namespaceImport = imp.getNamespaceImport();
    if (namespaceImport) {
      specifiers.push(`* as ${namespaceImport.getText()}`);
    }

    if (specifiers.length > 0) {
      imports[moduleSpec] = {
        direction: 'inward',
        type: moduleSpec.startsWith('.') ? 'internal-import' : 'external-import',
        specifiers: specifiers,
        functions: {},
        isTypeOnly: false,
        line: imp.getStartLineNumber(),
      };
    }
  }

  return imports;
}

/**
 * Анализирует файл с помощью ts-morph и извлекает дополнительную информацию
 */
function analyzeFileWithTsMorph(
  filePath: string,
  projectRoot: string,
  graphData?: GraphData
): TsMorphAnalysisResult {
  const result: TsMorphAnalysisResult = {
    functions: [],
    classes: [],
    imports: {},
    sourceFile: null,
    diagnostics: [],
  };

  try {
    const absPath = findFileInProject(filePath, projectRoot);
    if (!absPath || !fs.existsSync(absPath)) {
      result.diagnostics.push(`File not found: ${filePath}`);
      return result;
    }

    if (graphData) {
      const moduleExists = findModuleForEntity(filePath, graphData) !== null;
      if (!moduleExists) {
        result.diagnostics.push(`Module not found in graph: ${filePath}`);
      }
    }

    const project = new Project({
      compilerOptions: {
        target: 99,
        module: 99,
        allowJs: true,
        checkJs: false,
        skipLibCheck: true,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        resolveJsonModule: true,
        jsx: 2,
      },
      useInMemoryFileSystem: false,
    });

    const sourceFile = project.addSourceFileAtPath(absPath);
    if (!sourceFile) {
      result.diagnostics.push(`Failed to load source file: ${filePath}`);
      return result;
    }

    result.sourceFile = sourceFile;

    const functions = sourceFile.getFunctions();
    for (const func of functions) {
      const name = func.getName();
      if (!name) continue;

      if (graphData) {
        const funcExists = findModuleForEntity(name, graphData) !== null;
        if (!funcExists) {
          result.diagnostics.push(`Function not found in graph: ${name}`);
        }
      }

      const params = func.getParameters().map(p => p.getName());
      const returnType = func.getReturnType().getText();
      const isAsync = func.isAsync();
      const isExported = func.isExported();

      const calls = extractCallsFromFunction(func, name);
      const complexity = calculateComplexity(func);
      const security = extractSecurityInfo(func);

      const body = func.getBody()?.getText() || '';

      // Сигнатура для быстрого просмотра
      const paramsStr = params.join(', ');
      const signature = `${isAsync ? 'async ' : ''}function ${name}(${paramsStr}): ${returnType}`;

      // Ссылка VS Code
      const vscode = `vscode://file/${absPath}:${func.getStartLineNumber()}`;

      result.functions.push({
        name,
        params,
        paramTypes: params.map(() => 'any'),
        line: func.getStartLineNumber(),
        startLine: func.getStartLineNumber(),
        endLine: func.getEndLineNumber(),
        isAsync,
        isExported,
        isMethod: false,
        className: undefined,
        calls,
        calledBy: [],
        returnType,
        body,
        signature,
        vscode,
        isNested: false,
        parentFunction: undefined,
        isArrow: false,
        isEventHandler: false,
        eventType: undefined,
        depth: 0,
        complexity,
        security,
        _safeInfo: null,
      });
    }

    const classes = sourceFile.getClasses();
    for (const cls of classes) {
      const name = cls.getName();
      if (!name) continue;

      if (graphData) {
        const classExists = findModuleForEntity(name, graphData) !== null;
        if (!classExists) {
          result.diagnostics.push(`Class not found in graph: ${name}`);
        }
      }

      const { methods, methodDetails } = extractClassMethods(cls);
      const { properties, propertyDetails } = extractClassProperties(cls);

      // Ссылка VS Code для класса
      const vscode = `vscode://file/${absPath}:${cls.getStartLineNumber()}`;

      const body = cls.getText();

      result.classes.push({
        name,
        methods,
        methodDetails,
        properties,
        propertyDetails,
        line: cls.getStartLineNumber(),
        startLine: cls.getStartLineNumber(),
        endLine: cls.getEndLineNumber(),
        isExported: cls.isExported(),
        extends: cls.getExtends()?.getText(),
        implements: (cls.getImplements() || []).map(i => i.getText()),
        body,
        vscode,
        _safeInfo: null,
      });
    }

    result.imports = extractImportsFromSourceFile(sourceFile);

    const diagnostics = sourceFile.getPreEmitDiagnostics();
    for (const diag of diagnostics) {
      let message: string;
      const messageText = diag.getMessageText();
      if (typeof messageText === 'string') {
        message = messageText;
      } else {
        message = messageText.getMessageText();
      }
      result.diagnostics.push(message);
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    result.diagnostics.push(`Analysis error: ${errorMessage}`);
    if (process.env.DEBUG === 'true') {
      console.debug(`  ⚠️ ts-morph analysis failed for ${filePath}:`, errorMessage);
    }
  }

  return result;
}

/**
 * Обогащает существующие сущности данными из ts-morph
 */
function enrichWithTsMorph(
  entitiesMap: Record<string, EntitiesResult>,
  projectRoot: string,
  graphData?: GraphData
): Record<string, EntitiesResult> {
  const enrichedMap: Record<string, EntitiesResult> = {};

  for (const [modulePath, entities] of Object.entries(entitiesMap)) {
    if (!entities) {
      enrichedMap[modulePath] = entities;
      continue;
    }

    if (graphData) {
      const moduleExists = findModuleForEntity(modulePath, graphData) !== null;
      if (!moduleExists) {
        console.debug(`  ⚠️ Module not found in graph: ${modulePath}`);
      }
    }

    const tsMorphResult = analyzeFileWithTsMorph(modulePath, projectRoot, graphData);

    if (tsMorphResult.diagnostics.length > 0 && process.env.DEBUG === 'true') {
      console.debug(`  📋 Diagnostics for ${modulePath}:`, tsMorphResult.diagnostics);
    }

    const enrichedFunctions = ensureArray<any>(entities.functions).map((func: any) => {
      const tsFunc = tsMorphResult.functions.find(
        (f: EnhancedFunctionInfo) => f.name === func.name
      );
      if (tsFunc) {
        if (graphData) {
          const funcExists = findModuleForEntity(func.name, graphData) !== null;
          if (!funcExists) {
            // console.debug(`  ⚠️ Function not found in graph: ${func.name}`);
          }
        }
        // ✅ КОПИРУЕМ ТОЛЬКО СУЩЕСТВУЮЩИЕ ПОЛЯ, ИСПОЛЬЗУЯ safeString/safeNumber
        return {
          ...func,
          params: tsFunc.params.length > 0 ? tsFunc.params : func.params || [],
          returnType: tsFunc.returnType || func.returnType || 'any',
          isAsync: tsFunc.isAsync || func.isAsync || false,
          isExported: tsFunc.isExported || func.isExported || false,
          // ✅ КОПИРУЕМ calls С ПРОВЕРКОЙ НА СУЩЕСТВОВАНИЕ
          calls:
            tsFunc.calls && tsFunc.calls.length > 0
              ? tsFunc.calls.map((c: any) => safeString(c))
              : func.calls
                ? func.calls.map((c: any) => safeString(c))
                : [],
          // ✅ КОПИРУЕМ calledBy С ПРОВЕРКОЙ
          calledBy:
            tsFunc.calledBy && tsFunc.calledBy.length > 0
              ? tsFunc.calledBy.map((cb: any) => {
                  if (typeof cb === 'string') {
                    return { function: cb, module: modulePath, line: func.line || 0 };
                  }
                  return {
                    function: safeString(cb.function || cb),
                    module: safeString(cb.module || modulePath),
                    line: safeNumber(cb.line || func.line || 0),
                  };
                })
              : func.calledBy
                ? func.calledBy.map((cb: any) => {
                    if (typeof cb === 'string') {
                      return { function: cb, module: modulePath, line: func.line || 0 };
                    }
                    return {
                      function: safeString(cb.function || cb),
                      module: safeString(cb.module || modulePath),
                      line: safeNumber(cb.line || func.line || 0),
                    };
                  })
                : [],
          // ✅ КОПИРУЕМ complexity С ПРОВЕРКОЙ
          complexity: tsFunc.complexity || func.complexity || 1,
          // ✅ КОПИРУЕМ security С ПРОВЕРКОЙ
          security: tsFunc.security ||
            func.security || {
              hasEval: false,
              hasProcessEnv: false,
              hasSensitiveData: false,
              hasExec: false,
              hasPassword: false,
            },
          // ✅ КОПИРУЕМ body С ПРОВЕРКОЙ
          // body: tsFunc.body || func.body || '',
          // ✅ КОПИРУЕМ signature С ПРОВЕРКОЙ
          signature: tsFunc.signature || func.signature || '',
          // ✅ КОПИРУЕМ vscode С ПРОВЕРКОЙ
          vscode: tsFunc.vscode || func.vscode || '',
        };
      }
      return func;
    });

    const enrichedClasses = ensureArray<any>(entities.classes).map((cls: any) => {
      const tsClass = tsMorphResult.classes.find((c: EnhancedClassInfo) => c.name === cls.name);
      if (tsClass) {
        if (graphData) {
          const classExists = findModuleForEntity(cls.name, graphData) !== null;
          if (!classExists) {
            // console.debug(`  ⚠️ Class not found in graph: ${cls.name}`);
          }
        }

        return {
          ...cls,
          methods: tsClass.methods.length > 0 ? tsClass.methods : cls.methods || [],
          properties: tsClass.properties.length > 0 ? tsClass.properties : cls.properties || [],
          extends: tsClass.extends || cls.extends,
          implements:
            tsClass.implements && tsClass.implements.length > 0
              ? tsClass.implements
              : cls.implements || [],
          // body: tsClass.body || cls.body || '',
          vscode: tsClass.vscode || cls.vscode || '',
        };
      }
      return cls;
    });

    const enrichedImports = {
      ...entities.imports,
      ...Object.entries(tsMorphResult.imports).map(([source, imp]) => ({
        source,
        specifiers: imp.specifiers,
        isTypeOnly: imp.isTypeOnly,
        loc: { start: { line: imp.line, column: 1 } },
      })),
    };

    enrichedMap[modulePath] = {
      ...entities,
      functions: enrichedFunctions,
      classes: enrichedClasses,
      imports: enrichedImports,
    };
  }

  return enrichedMap;
}

/**
 * Добавляет Vue-анализ к пакету
 */
function addVueAnalysis(modulePath: string, pkg: EnhancedPackageInfo): void {
  if (!modulePath.endsWith('.vue')) return;

  try {
    const vueAnalysis = analyzeVueComponent(modulePath, {
      includeTemplateAST: true,
      includeScriptAST: true,
      extractComposableCalls: true,
    });

    if (vueAnalysis) {
      pkg.vueAnalysis = {
        props: vueAnalysis.props,
        emits: vueAnalysis.emits,
        slots: vueAnalysis.slots,
        composables: vueAnalysis.composables.map((c: any) => c.name),
        templateComplexity: vueAnalysis.template.complexity,
        scriptType: vueAnalysis.script.isSetup ? 'setup' : 'options',
        isTS: vueAnalysis.script.isTS,
        stats: {
          scriptLines: vueAnalysis.stats.scriptLines,
          templateLines: vueAnalysis.stats.templateLines,
          styleCount: vueAnalysis.stats.styleCount,
        },
      };

      pkg.fileStats.functions =
        vueAnalysis.composables.length +
        vueAnalysis.script.content.split('\n').filter((l: string) => l.includes('function')).length;
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`⚠️ Failed to analyze Vue component ${modulePath}:`, errorMessage);
  }
}

/**
 * Получает размер и строки файла
 */
function getFileStats(modulePath: string, projectRoot: string): { size: number; lines: number } {
  let size = 0;
  let lines = 0;

  try {
    const absPath = findFileInProject(modulePath, projectRoot);
    if (absPath && fs.existsSync(absPath)) {
      const content = fs.readFileSync(absPath, 'utf-8');
      size = content.length;
      lines = content.split('\n').length;
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (process.env.DEBUG === 'true') {
      console.debug(`  ⚠️ Could not read file ${modulePath}:`, errorMessage);
    }
  }

  return { size, lines };
}

// ============================================================
// НОВЫЕ ФУНКЦИИ ДЛЯ ОБОГАЩЕНИЯ ИСХОДНЫМ КОДОМ
// ============================================================

/**
 * Создает ссылку на VS Code для файла и строки
 */
function getVSCodeLink(filePath: string, line?: number): string {
  const absolutePath = path.resolve(filePath);
  const base = `vscode://file/${absolutePath}`;
  return line ? `${base}:${line}` : base;
}

/**
 * Извлекает тело функции из исходного кода
 */
function extractFunctionBody(code: string, startLine: number, endLine: number): string {
  if (!code || !startLine || !endLine) return '';
  const lines = code.split('\n');
  return lines.slice(Math.max(0, startLine - 1), Math.min(lines.length, endLine)).join('\n');
}

/**
 * Обогащает функции данными из исходного кода (body, signature, vscode)
 */
function enrichFunctionsWithSourceCode(
  functions: EnhancedFunctionInfo[],
  sourceCode: string,
  filePath: string,
  includeBody: boolean = false
): EnhancedFunctionInfo[] {
  if (!functions || functions.length === 0) return functions;

  const enriched: EnhancedFunctionInfo[] = [];

  for (const func of functions) {
    const enrichedFunc = { ...func };

    // 1. Добавляем ссылку VS Code
    if (!enrichedFunc.vscode) {
      enrichedFunc.vscode = getVSCodeLink(filePath, func.line);
    }

    // 2. Добавляем тело функции (только если включено)
    if (includeBody) {
      console.log('%%%%%%%%%%%%%%%%%%%%% 1 %%%%%%%%%%%%%%%%%%%%%', includeBody);
      if (!enrichedFunc.body && func.startLine && func.endLine && sourceCode) {
        enrichedFunc.body = extractFunctionBody(sourceCode, func.startLine, func.endLine);
      }
    } else {
      // Если body отключено, удаляем его
      delete enrichedFunc.body;
    }

    // 3. Добавляем сигнатуру
    if (!enrichedFunc.signature) {
      const params = (func.params || []).join(', ');
      const returnType = func.returnType || 'any';
      const asyncStr = func.isAsync ? 'async ' : '';
      const exportStr = func.isExported ? 'export ' : '';
      const methodStr = func.isMethod && func.className ? `${func.className}.` : '';
      enrichedFunc.signature = `${exportStr}${asyncStr}function ${methodStr}${func.name}(${params}): ${returnType}`;
    }

    enriched.push(enrichedFunc);
  }

  return enriched;
}

/**
 * Обогащает классы данными из исходного кода
 */
function enrichClassesWithSourceCode(
  classes: EnhancedClassInfo[],
  sourceCode: string,
  filePath: string,
  includeBody: boolean = false
): EnhancedClassInfo[] {
  if (!classes || classes.length === 0) return classes;

  const enriched: EnhancedClassInfo[] = [];

  for (const cls of classes) {
    const enrichedCls = { ...cls };

    // 1. Добавляем ссылку VS Code
    if (!enrichedCls.vscode) {
      enrichedCls.vscode = getVSCodeLink(filePath, cls.line);
    }

    // 2. Добавляем тело класса (только если включено)
    if (includeBody) {
      if (!enrichedCls.body && cls.startLine && cls.endLine && sourceCode) {
        enrichedCls.body = extractFunctionBody(sourceCode, cls.startLine, cls.endLine);
      }
    } else {
      delete enrichedCls.body;
    }

    enriched.push(enrichedCls);
  }

  return enriched;
}

// ============================================================
// ОСНОВНАЯ ФУНКЦИЯ buildPackages - С СОХРАНЕНИЕМ ВСЕХ ДАННЫХ
// ============================================================

/**
 * Строит пакеты для всех модулей
 * ✅ СОХРАНЯЕТ calls, calledBy, body, complexity, security, vscode, signature
 */
export function buildPackages(
  rootKey: string,
  graph: Record<string, string[]>,
  entitiesMap: Record<string, EntitiesResult>,
  projectRoot: string,
  options?: { includeBody?: boolean }
): Record<string, EnhancedPackageInfo> {
  const includeBody = options?.includeBody ?? false;
  const packages: Record<string, EnhancedPackageInfo> = {};

  const graphData: GraphData = {
    rootKey,
    graph,
  };

  const graphInfo = getGraphStructureInfo(graphData);

  console.log(`   📊 Graph structure:`);
  console.log(`      • Total modules: ${graphInfo.totalModules}`);
  console.log(`      • Valid modules: ${graphInfo.validModules.length}`);
  console.log(`      • Invalid modules: ${graphInfo.invalidModules.length}`);
  console.log(`      • Has cycles: ${graphInfo.hasCycles ? '⚠️ YES' : '✅ NO'}`);
  console.log(`      • Max depth: ${graphInfo.maxDepth}`);
  console.log(`      • Acyclic: ${graphInfo.isAcyclic ? '✅' : '❌'}`);

  if (graphInfo.cyclicEdges.length > 0) {
    console.log(`      • Cyclic edges: ${graphInfo.cyclicEdges.length}`);
    for (const cycle of graphInfo.cyclicEdges.slice(0, 3)) {
      console.log(`        - ${cycle}`);
    }
    if (graphInfo.cyclicEdges.length > 3) {
      console.log(`        - ... and ${graphInfo.cyclicEdges.length - 3} more`);
    }
  }

  if (graphInfo.invalidModules.length > 0) {
    console.log(`      ⚠️ Invalid modules (not found in graph):`);
    for (const invalidModule of graphInfo.invalidModules.slice(0, 3)) {
      console.log(`        - ${invalidModule}`);
    }
    if (graphInfo.invalidModules.length > 3) {
      console.log(`        - ... and ${graphInfo.invalidModules.length - 3} more`);
    }
  }

  // 1. Обогащаем данные с помощью ts-morph
  const enrichedEntitiesMap = enrichWithTsMorph(entitiesMap, projectRoot, graphData);

  // 2. Строим карту функций для быстрого поиска calledBy
  const functionMap = buildFunctionMap(enrichedEntitiesMap, graphData);

  // 3. Строим граф вызовов
  const callGraph = buildCallGraph(enrichedEntitiesMap, graphData);

  // 4. Используем functionMap для валидации и обогащения данных
  for (const [funcName, info] of callGraph) {
    const funcInfo = findFunctionInfo(functionMap, funcName);
    if (!funcInfo) {
      console.debug(
        `  ⚠️ Function '${funcName}' not found in function map, but exists in call graph`
      );
    } else {
      info.isExported = funcInfo.isExported;
      info.module = funcInfo.module;
      info.line = funcInfo.line;
    }
  }

  // 5. Заполняем calledBy для всех функций через граф вызовов
  for (const [funcName, info] of callGraph) {
    const entities = enrichedEntitiesMap[info.module];
    if (entities) {
      const func = ensureArray<any>(entities.functions).find(
        (f: FunctionEntity) => f.name === funcName
      );
      if (func) {
        if (!func.calledBy) {
          func.calledBy = [];
        }
        for (const callerName of info.calledBy) {
          const callerExists = functionExistsInMap(functionMap, callerName);
          if (callerExists) {
            if (!func.calledBy.some((cb: any) => cb.function === callerName)) {
              const callerInfo = callGraph.get(callerName);
              if (callerInfo) {
                func.calledBy.push({
                  function: callerName,
                  module: callerInfo.module,
                  line: callerInfo.line,
                });
              }
            }
          }
        }
      }
    }
  }

  // 6. Строим пакеты для каждого модуля
  let processedCount = 0;
  const totalModules = Object.keys(enrichedEntitiesMap).length;

  for (const [modulePath, entities] of Object.entries(enrichedEntitiesMap)) {
    processedCount++;
    const relativePath = path.relative(projectRoot, modulePath);

    if (totalModules > 5 && processedCount % 10 === 0) {
      console.log(`   📊 Обработано ${processedCount}/${totalModules} модулей`);
    }

    if (!entities || typeof entities !== 'object') {
      packages[modulePath] = createEmptyPackage(modulePath, relativePath);
      continue;
    }

    const isEntry = modulePath === rootKey;
    const ext = path.extname(modulePath);
    let language: EnhancedPackageInfo['language'] = 'typescript';
    if (ext === '.js' || ext === '.jsx') language = 'javascript';
    else if (ext === '.vue') language = 'vue';
    else if (ext === '.tsx') language = 'jsx';

    // ✅ СОХРАНЯЕМ ВСЕ ПОЛЯ ПРИ КОНВЕРТАЦИИ
    let fileEntities = convertToEnhancedEntityInfo(entities);

    // ✅ ЧИТАЕМ ИСХОДНЫЙ КОД ФАЙЛА ДЛЯ ОБОГАЩЕНИЯ
    let sourceCode = '';
    let vscodeLink = '';
    try {
      const absPath = path.resolve(projectRoot, modulePath);
      if (fs.existsSync(absPath)) {
        sourceCode = fs.readFileSync(absPath, 'utf-8');
        vscodeLink = getVSCodeLink(absPath);
      }
    } catch (error) {
      // Игнорируем ошибки чтения
    }

    // ✅ ОБОГАЩАЕМ ФУНКЦИИ ДАННЫМИ ИЗ ИСХОДНОГО КОДА
    if (sourceCode) {
      fileEntities.functions = enrichFunctionsWithSourceCode(
        fileEntities.functions,
        sourceCode,
        modulePath,
        includeBody
      );
      fileEntities.classes = enrichClassesWithSourceCode(
        fileEntities.classes,
        sourceCode,
        modulePath,
        includeBody
      );
    }

    // ✅ ДОПОЛНИТЕЛЬНО КОПИРУЕМ calls И calledBy ИЗ ОРИГИНАЛА
    for (const func of fileEntities.functions) {
      const origFunc = ensureArray(entities.functions).find(
        (f: any) => f.name === func.name
      ) as any;

      if (origFunc) {
        // ✅ КОПИРУЕМ calls С ПРОВЕРКОЙ
        if (origFunc.calls && Array.isArray(origFunc.calls) && origFunc.calls.length > 0) {
          func.calls = origFunc.calls.map((c: any) => safeString(c));
        }
        // ✅ КОПИРУЕМ calledBy С ПРОВЕРКОЙ
        if (origFunc.calledBy && Array.isArray(origFunc.calledBy) && origFunc.calledBy.length > 0) {
          func.calledBy = origFunc.calledBy.map((cb: any) => {
            if (typeof cb === 'string') {
              return { function: cb, module: modulePath, line: func.line };
            }
            return {
              function: safeString(cb.function || cb),
              module: safeString(cb.module || modulePath),
              line: safeNumber(cb.line || func.line),
            };
          });
        }
        // ✅ КОПИРУЕМ body С ПРОВЕРКОЙ
        if (origFunc.body && typeof origFunc.body === 'string' && !func.body) {
          func.body = origFunc.body;
        }
        // ✅ КОПИРУЕМ complexity С ПРОВЕРКОЙ
        if (origFunc.complexity !== undefined) {
          func.complexity = origFunc.complexity;
        }
        // ✅ КОПИРУЕМ security С ПРОВЕРКОЙ
        if (origFunc.security) {
          func.security = origFunc.security;
        }
        // ✅ КОПИРУЕМ signature С ПРОВЕРКОЙ
        if (origFunc.signature && !func.signature) {
          func.signature = origFunc.signature;
        }
        // ✅ КОПИРУЕМ vscode С ПРОВЕРКОЙ
        if (origFunc.vscode && !func.vscode) {
          func.vscode = origFunc.vscode;
        }
      }
    }

    // ✅ ЛОГИРУЕМ СТАТИСТИКУ ДЛЯ МОДУЛЯ
    const callsCount = fileEntities.functions.reduce((sum, f) => sum + (f.calls?.length || 0), 0);
    const bodiesCount = fileEntities.functions.filter(f => f.body).length;
    const vscodeCount = fileEntities.functions.filter(f => f.vscode).length;
    if (fileEntities.functions.length > 0) {
      console.log(
        `   📦 ${modulePath}: ${fileEntities.functions.length} функций, ${callsCount} вызовов, ${bodiesCount} с телами, ${vscodeCount} со ссылками VS Code`
      );
    }

    const { size, lines } = getFileStats(modulePath, projectRoot);

    // ✅ ИСПОЛЬЗУЕМ ОБНОВЛЕННЫЕ buildImports И buildExports
    const imports = buildImports(entities, enrichedEntitiesMap, graphData);
    const exports = buildExports(entities, enrichedEntitiesMap, graphData);

    const fileStats = {
      size,
      lines,
      functions: entities.functions?.length || 0,
      classes: entities.classes?.length || 0,
      constants: entities.constants?.length || 0,
      interfaces: entities.interfaces?.length || 0,
      types: entities.types?.length || 0,
      variables: entities.variables?.length || 0,
    };

    const pkg: EnhancedPackageInfo = {
      version: '1.0.0',
      resolved: `file:${modulePath}`,
      displayPath: relativePath,
      type: 'module',
      language,
      isEntry,
      imports,
      exports,
      entities: fileEntities,
      fileStats,
      vscode: vscodeLink || undefined
    };

    // Добавляем Vue-анализ
    addVueAnalysis(modulePath, pkg);

    packages[modulePath] = pkg;
  }

  // 7. Дополнительный проход для обогащения exports.consumers через граф вызовов
  for (const pkg of Object.values(packages)) {
    for (const [exportName, exportInfo] of Object.entries(pkg.exports)) {
      const funcExists = functionExistsInMap(functionMap, exportName);
      if (funcExists) {
        const consumers = findConsumersForExport(exportName, callGraph, graphData);
        exportInfo.consumers = consumers;
      }
    }
  }

  // 8. Используем findExportsUsedInModule для каждого модуля
  for (const [modulePath, _pkg] of Object.entries(packages)) {
    const entities = enrichedEntitiesMap[modulePath];
    if (!entities) continue;

    const usedExports = findExportsUsedInModule(modulePath, entities, callGraph, graphData);
    if (usedExports.length > 0) {
      console.debug(`  📦 Module ${modulePath} uses exports: ${usedExports.join(', ')}`);
    }
  }

  // 9. Логируем итоговую статистику
  let totalCalls = 0;
  let totalWithCalls = 0;
  let totalFuncs = 0;
  let totalWithBodies = 0;
  let totalWithVSCode = 0;
  for (const pkg of Object.values(packages)) {
    for (const func of pkg.entities?.functions || []) {
      totalFuncs++;
      if (func.calls && func.calls.length > 0) {
        totalCalls += func.calls.length;
        totalWithCalls++;
      }
      if (func.body) {
        totalWithBodies++;
      }
      if (func.vscode) {
        totalWithVSCode++;
      }
    }
  }

  console.log(`   📊 Package build complete:`);
  console.log(`      • Packages created: ${Object.keys(packages).length}`);
  console.log(`      • Graph is ${graphInfo.isAcyclic ? 'acyclic ✅' : 'cyclic ⚠️'}`);
  console.log(`      • Total functions in call graph: ${callGraph.size}`);
  console.log(`      • Total functions in function map: ${functionMap.size}`);
  console.log(`      • Функций с вызовами: ${totalWithCalls}`);
  console.log(`      • Всего вызовов: ${totalCalls}`);
  console.log(`      • Функций с телами: ${totalWithBodies}`);
  console.log(`      • Функций со ссылками VS Code: ${totalWithVSCode}`);

  return packages;
}
