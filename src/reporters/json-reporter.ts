// src/reporters/json-reporter.ts
import fs from 'fs';
import path from 'path';
import { Project, Node } from 'ts-morph';
import type { EntitiesResult } from '../core/entity-extractor.js';

// ============================================================
// СУЩЕСТВУЮЩИЕ ТИПЫ (ОСТАВЛЯЕМ ДЛЯ СОВМЕСТИМОСТИ)
// ============================================================

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

// ============================================================
// НОВЫЕ ТИПЫ ДЛЯ РАСШИРЕННОГО ОТЧЕТА
// ============================================================

export interface EnhancedFunctionInfo {
  name: string;
  params: string[];
  paramTypes?: string[];
  line: number;
  startLine?: number;
  endLine?: number;
  isAsync: boolean;
  isExported: boolean;
  isMethod?: boolean;
  className?: string;
  calls: string[];
  calledBy: string[];
  returnType?: string;
  body?: string;
}

export interface EnhancedConstantInfo {
  name: string;
  value?: any;
  line: number;
  isExported: boolean;
  type?: string;
}

export interface EnhancedVariableInfo {
  name: string;
  value?: any;
  line: number;
  isExported: boolean;
  type?: string;
}

export interface EnhancedInterfaceInfo {
  name: string;
  properties: string[];
  line: number;
  isExported: boolean;
  extends?: string[];
  startLine?: number;
  endLine?: number;
}

export interface EnhancedTypeInfo {
  name: string;
  definition: string;
  line: number;
  isExported: boolean;
}

export interface EnhancedClassInfo {
  name: string;
  methods: string[];
  methodDetails?: {
    name: string;
    params: string[];
    returnType?: string;
    isAsync: boolean;
    line: number;
  }[];
  properties: string[];
  propertyDetails?: {
    name: string;
    type?: string;
    line: number;
  }[];
  line: number;
  isExported: boolean;
  extends?: string;
  implements?: string[];
  startLine?: number;
  endLine?: number;
}

export interface EnhancedEntityInfo {
  functions: EnhancedFunctionInfo[];
  constants: EnhancedConstantInfo[];
  variables: EnhancedVariableInfo[];
  interfaces: EnhancedInterfaceInfo[];
  types: EnhancedTypeInfo[];
  classes: EnhancedClassInfo[];
}

export interface EnhancedPackageInfo {
  version: string;
  resolved: string;
  type: 'module' | 'commonjs';
  language: 'typescript' | 'javascript' | 'vue' | 'jsx';
  isEntry: boolean;
  imports: Record<string, any>;
  exports: Record<string, any>;
  entities: EnhancedEntityInfo;
  fileStats: {
    size: number;
    lines: number;
    functions: number;
    classes: number;
    constants: number;
    interfaces: number;
    types: number;
    variables: number;
  };
}

export interface EnhancedPackageLockReport {
  name: string;
  version: string;
  lockfileVersion: number;
  packages: Record<string, EnhancedPackageInfo>;
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
    imports: Record<string, {
      importsFrom: {
        module: string;
        type: 'named' | 'default' | 'namespace';
        imports: string[];
      }[];
    }>;
    exports: Record<string, {
      exportsTo: {
        module: string;
        type: 'named' | 'default';
        exports: string[];
      }[];
    }>;
  };
  callGraph?: Record<string, string[]>;
  entityStats?: {
    totalFunctions: number;
    totalConstants: number;
    totalVariables: number;
    totalInterfaces: number;
    totalTypes: number;
    totalClasses: number;
    totalCalls: number;
    totalExportedFunctions: number;
    totalAsyncFunctions: number;
  };
  fileStats?: {
    totalFiles: number;
    totalSize: number;
    totalLines: number;
  };
  timestamp?: string;
}

// ============================================================
// СУЩЕСТВУЮЩИЕ ФУНКЦИИ (СОХРАНЯЕМ)
// ============================================================

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
 * ТЕПЕРЬ ИСПОЛЬЗУЕТ entitiesMap ВМЕСТО ПОВТОРНОГО ИЗВЛЕЧЕНИЯ
 */
export function savePackageLockReport(
  rootKey: string,
  graph: Record<string, string[]>,
  entitiesMap: Record<string, EntitiesResult>,
  filePaths: string[],
  outputPath: string
): void {
  const report = buildEnhancedPackageLockReport(rootKey, graph, entitiesMap, filePaths);
  const json = JSON.stringify(report, null, 2);
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(outputPath, json, 'utf-8');
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
}

/**
 * Сохраняет результат графа вызовов между функциями
 */
export function saveCallGraphResult(callGraphResult: any, outputPath: string): void {
  const json = JSON.stringify(callGraphResult, null, 2);
  fs.writeFileSync(outputPath, json, 'utf-8');
}

// ============================================================
// СУЩЕСТВУЮЩИЕ ФУНКЦИИ ПОСТРОЕНИЯ ГРАФОВ
// ============================================================

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

    nodes.push({
      id: modulePath,
      name: path.basename(modulePath),
      type: modulePath.endsWith('.vue') ? 'vue' : 'module',
      level: modulePath === data.rootKey ? 0 : 1,
      metadata: { size, lines, language, isEntry },
    });
  }

  for (const [from, deps] of Object.entries(data.graph)) {
    for (const to of deps) {
      const isExternal = to.startsWith('@') || to.includes('/');
      const specifiers: string[] = [];
      for (const entity of entities.functions) {
        if (entity.isExported && (to.includes(entity.name) || entity.name.includes(to))) {
          specifiers.push(entity.name);
        }
      }
      edges.push({
        from,
        to,
        type: isExternal ? 'external' : 'import',
        specifiers: specifiers.length > 0 ? specifiers : [path.basename(to).replace(/\.[^.]+$/, '')],
      });
    }
  }

  return { nodes, edges };
}

/**
 * Строит граф сущностей
 */
export function buildEntityGraph(data: GraphData, entities: EntitiesResult): EntityGraph {
  const nodes: EntityNode[] = [];
  const edges: EntityEdge[] = [];

  for (const func of entities.functions) {
    const modulePath = findModuleForEntity(func.name, data);
    const nodeId = modulePath ? `${modulePath}#${func.name}` : `#${func.name}`;
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
        importedFrom: modulePath !== data.rootKey ? modulePath : undefined,
      },
    });

    for (const call of calls) {
      let targetModule = findModuleForEntity(call, data);
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
  }

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

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ ПОИСКА ФАЙЛОВ
// ============================================================

/**
 * Находит корень проекта (где находится package.json)
 */
export function findProjectRoot(startDir: string): string | null {
  let currentDir = path.resolve(startDir);
  const root = path.parse(currentDir).root;

  while (currentDir !== root) {
    const packagePath = path.join(currentDir, 'package.json');
    if (fs.existsSync(packagePath)) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }
  return null;
}

/**
 * Находит файл в проекте по имени
 */
function findFileInProject(filePath: string, projectRoot: string): string | null {
  const fileName = path.basename(filePath);

  // Проверяем основные пути
  const candidates = [
    path.resolve(projectRoot, filePath),
    path.resolve(projectRoot, 'src', filePath),
    path.resolve(projectRoot, 'packages/ast-analyzer/src', filePath),
    path.resolve(process.cwd(), filePath),
    path.resolve(process.cwd(), 'src', filePath),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }

  // Рекурсивный поиск по имени файла в src
  const srcDir = path.resolve(projectRoot, 'src');
  if (fs.existsSync(srcDir)) {
    const walkDir = (dir: string): string | null => {
      try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const fullPath = path.join(dir, file);
          if (fs.statSync(fullPath).isDirectory()) {
            const result = walkDir(fullPath);
            if (result) return result;
          } else if (file === fileName) {
            return fullPath;
          }
        }
      } catch {
        // Игнорируем ошибки
      }
      return null;
    };

    const foundPath = walkDir(srcDir);
    if (foundPath) {
      return foundPath;
    }
  }

  return null;
}

// ============================================================
// НОВАЯ ФУНКЦИЯ: extractEntitiesFromFile
// ============================================================

/**
 * Извлекает все сущности из файла через ts-morph
 */
export function extractEntitiesFromFile(filePath: string): EnhancedEntityInfo {
  const entities: EnhancedEntityInfo = {
    functions: [],
    constants: [],
    variables: [],
    interfaces: [],
    types: [],
    classes: [],
  };

  const absolutePath = filePath;

  if (!fs.existsSync(absolutePath)) {
    console.warn(`⚠️ Файл не найден: ${absolutePath}`);
    return entities;
  }

  try {
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

    const sourceFile = project.addSourceFileAtPath(absolutePath);
    if (!sourceFile) {
      console.warn(`⚠️ Не удалось загрузить файл: ${absolutePath}`);
      return entities;
    }

    // ============================================
    // 1. ИЗВЛЕЧЕНИЕ ФУНКЦИЙ
    // ============================================
    const functions = sourceFile.getFunctions();
    for (const functionDecl of functions) {
      const name = functionDecl.getName();
      if (!name) continue;

      const params = functionDecl.getParameters().map(p => p.getName());
      const returnType = functionDecl.getReturnType().getText();
      const isAsync = functionDecl.isAsync();
      const isExported = functionDecl.isExported();

      const calls: string[] = [];
      functionDecl.forEachDescendant(node => {
        if (Node.isCallExpression(node)) {
          const expr = node.getExpression();
          if (Node.isIdentifier(expr)) {
            const calledName = expr.getText();
            if (calledName && calledName !== name) {
              calls.push(calledName);
            }
          }
        }
      });

      entities.functions.push({
        name,
        params,
        paramTypes: params.map(() => 'any'),
        line: functionDecl.getStartLineNumber(),
        startLine: functionDecl.getStartLineNumber(),
        endLine: functionDecl.getEndLineNumber(),
        isAsync,
        isExported,
        isMethod: false,
        className: undefined,
        calls: [...new Set(calls)],
        calledBy: [],
        returnType,
        body: functionDecl.getBody()?.getText()?.substring(0, 200) || '',
      });
    }

    // ============================================
    // 2. ИЗВЛЕЧЕНИЕ КЛАССОВ
    // ============================================
    const classes = sourceFile.getClasses();
    for (const cls of classes) {
      const name = cls.getName();
      if (!name) continue;

      const methods: string[] = [];
      const methodDetails: EnhancedClassInfo['methodDetails'] = [];
      const properties: string[] = [];
      const propertyDetails: EnhancedClassInfo['propertyDetails'] = [];

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

      entities.classes.push({
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
        implements: cls.getImplements().map(i => i.getText()),
      });
    }

    // ============================================
    // 3. ИЗВЛЕЧЕНИЕ КОНСТАНТ И ПЕРЕМЕННЫХ
    // ============================================
    const variableDeclarations = sourceFile.getVariableDeclarations();
    for (const decl of variableDeclarations) {
      const name = decl.getName();
      const initializer = decl.getInitializer();
      const isConst = decl.getVariableStatement()?.getDeclarationKind() === 'const';

      const info = {
        name,
        line: decl.getStartLineNumber(),
        isExported: decl.isExported(),
        type: initializer ? initializer.getType().getText() : 'any',
        value: initializer ? extractValueFromNode(initializer) : undefined,
      };

      if (isConst) {
        entities.constants.push(info);
      } else {
        entities.variables.push(info);
      }
    }

    // ============================================
    // 4. ИЗВЛЕЧЕНИЕ ИНТЕРФЕЙСОВ
    // ============================================
    const interfaces = sourceFile.getInterfaces();
    for (const intf of interfaces) {
      const name = intf.getName();
      if (!name) continue;

      const properties: string[] = [];
      for (const prop of intf.getProperties()) {
        properties.push(prop.getName());
      }

      entities.interfaces.push({
        name,
        properties,
        line: intf.getStartLineNumber(),
        startLine: intf.getStartLineNumber(),
        endLine: intf.getEndLineNumber(),
        isExported: intf.isExported(),
        extends: intf.getExtends().map(e => e.getText()),
      });
    }

    // ============================================
    // 5. ИЗВЛЕЧЕНИЕ ТИПОВ (TYPE ALIASES)
    // ============================================
    const typeAliases = sourceFile.getTypeAliases();
    for (const typeAlias of typeAliases) {
      const name = typeAlias.getName();
      if (!name) continue;

      entities.types.push({
        name,
        definition: typeAlias.getType().getText(),
        line: typeAlias.getStartLineNumber(),
        isExported: typeAlias.isExported(),
      });
    }

    // ============================================
    // 6. ПОСТРОЕНИЕ ГРАФА ВЫЗОВОВ
    // ============================================
    const callGraph: Record<string, string[]> = {};
    for (const func of entities.functions) {
      callGraph[func.name] = func.calls;
    }

    for (const func of entities.functions) {
      for (const otherFunc of entities.functions) {
        if (otherFunc.calls.includes(func.name) && !func.calledBy.includes(otherFunc.name)) {
          func.calledBy.push(otherFunc.name);
        }
      }
    }

    const relativePath = path.relative(process.cwd(), absolutePath);
    console.log(`✅ Извлечено сущностей из ${relativePath}:`);
    console.log(`   Функций: ${entities.functions.length}`);
    console.log(`   Классов: ${entities.classes.length}`);
    console.log(`   Констант: ${entities.constants.length}`);
    console.log(`   Интерфейсов: ${entities.interfaces.length}`);
    console.log(`   Типов: ${entities.types.length}`);
    console.log(`   Переменных: ${entities.variables.length}`);

    return entities;
  } catch (error) {
    console.error(`❌ Ошибка при извлечении сущностей из ${absolutePath}:`, error);
    return entities;
  }
}

/**
 * Вспомогательная функция для извлечения значения из узла
 */
function extractValueFromNode(node: Node): any {
  try {
    const text = node.getText();

    if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
      return text.slice(1, -1);
    }

    if (!isNaN(Number(text)) && text !== '') {
      return Number(text);
    }

    if (text === 'true') return true;
    if (text === 'false') return false;
    if (text === 'null') return null;
    if (text === 'undefined') return undefined;

    if (Node.isArrayLiteralExpression(node)) {
      return node.getElements().map(e => extractValueFromNode(e));
    }

    if (Node.isObjectLiteralExpression(node)) {
      const result: Record<string, any> = {};
      for (const prop of node.getProperties()) {
        if (Node.isPropertyAssignment(prop)) {
          const name = prop.getName();
          const initializer = prop.getInitializer();
          if (initializer) {
            result[name] = extractValueFromNode(initializer);
          }
        }
      }
      return result;
    }

    if (Node.isIdentifier(node)) {
      return node.getText();
    }

    return undefined;
  } catch (error) {
    return undefined;
  }
}

// ============================================================
// НОВАЯ ФУНКЦИЯ: buildEnhancedPackageLockReport (ИСПРАВЛЕНА)
// ============================================================

/**
 * Строит расширенный отчет в стиле package-lock
 * Теперь принимает entitiesMap для избежания повторного извлечения
 * И ПРАВИЛЬНО считает totalCalls
 */
export function buildEnhancedPackageLockReport(
  rootKey: string,
  graph: Record<string, string[]>,
  entitiesMap: Record<string, EntitiesResult>,
  filePaths: string[]
): EnhancedPackageLockReport {
  const packages: Record<string, EnhancedPackageInfo> = {};
  const inwardDeps: Record<string, string[]> = {};
  const outwardDeps: Record<string, string[]> = {};
  const importsFlow: EnhancedPackageLockReport['importExportFlow']['imports'] = {};
  const exportsFlow: EnhancedPackageLockReport['importExportFlow']['exports'] = {};
  const callGraph: Record<string, string[]> = {};

  let totalFunctions = 0;
  let totalConstants = 0;
  let totalVariables = 0;
  let totalInterfaces = 0;
  let totalTypes = 0;
  let totalClasses = 0;
  let totalCalls = 0;
  let totalExportedFunctions = 0;
  let totalAsyncFunctions = 0;

  // Инициализация структур
  for (const modulePath of Object.keys(graph)) {
    inwardDeps[modulePath] = [];
    outwardDeps[modulePath] = [];
    importsFlow[modulePath] = { importsFrom: [] };
    exportsFlow[modulePath] = { exportsTo: [] };
  }

  // ✅ Находим корень проекта
  const projectRoot = findProjectRoot(process.cwd()) || process.cwd();

  // ✅ Используем переданные сущности вместо повторного извлечения
  const allFileEntities = new Map<string, EnhancedEntityInfo>();

  // ✅ ПЕРВЫЙ ПРОХОД: сбор статистики и преобразование сущностей
  for (const [modulePath, entities] of Object.entries(entitiesMap)) {
    // Преобразуем EntitiesResult в EnhancedEntityInfo
    const enhancedEntities = convertToEnhancedEntityInfo(entities);
    allFileEntities.set(modulePath, enhancedEntities);

    // Собираем общую статистику
    totalFunctions += entities.functions.length;
    totalConstants += entities.constants.length;
    totalVariables += entities.variables.length;
    totalInterfaces += entities.interfaces.length;
    totalTypes += entities.types.length;
    totalClasses += entities.classes.length;

    // ✅ Собираем вызовы для callGraph и totalCalls
    for (const func of entities.functions) {
      const key = func.isMethod && func.className ? `${func.className}.${func.name}` : func.name;
      if (!callGraph[key]) {
        callGraph[key] = [];
      }
      const calls = func.calls || [];
      callGraph[key] = calls;
      totalCalls += calls.length;
      if (func.isExported) totalExportedFunctions++;
      if (func.isAsync) totalAsyncFunctions++;
    }
  }

  // ✅ ВТОРОЙ ПРОХОД: построение пакетов
  for (const [modulePath, entities] of Object.entries(entitiesMap)) {
    const isEntry = modulePath === rootKey;
    const ext = path.extname(modulePath);
    let language: EnhancedPackageInfo['language'] = 'typescript';
    if (ext === '.js' || ext === '.jsx') language = 'javascript';
    else if (ext === '.vue') language = 'vue';
    else if (ext === '.tsx') language = 'jsx';

    const relativePath = path.relative(projectRoot, modulePath);
    const fileEntities = allFileEntities.get(relativePath) || {
      functions: [],
      constants: [],
      variables: [],
      interfaces: [],
      types: [],
      classes: [],
    };

    let size = 0;
    let lines = 0;
    try {
      const absPath = findFileInProject(modulePath, projectRoot);
      if (absPath && fs.existsSync(absPath)) {
        const content = fs.readFileSync(absPath, 'utf-8');
        size = content.length;
        lines = content.split('\n').length;
      }
    } catch {
      // Игнорируем ошибки
    }

    // Строим импорты
    const imports: EnhancedPackageInfo['imports'] = {};
    for (const imp of entities.imports) {
      const importKey = imp.source;
      imports[importKey] = {
        direction: 'inward',
        type: imp.source.startsWith('.') ? 'internal-import' : 'external-import',
        specifiers: imp.specifiers,
        functions: {},
      };
    }

    // Строим экспорты
    const exports: EnhancedPackageInfo['exports'] = {};
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

    // fileStats берем из entitiesMap (уже извлеченные данные)
    const fileStats = {
      size,
      lines,
      functions: entities.functions.length,
      classes: entities.classes.length,
      constants: entities.constants.length,
      interfaces: entities.interfaces.length,
      types: entities.types.length,
      variables: entities.variables.length,
    };

    packages[modulePath] = {
      version: '1.0.0',
      resolved: `file:${modulePath}`,
      type: 'module',
      language,
      isEntry,
      imports,
      exports,
      entities: fileEntities,
      fileStats,
    };
  }

  // Строим граф зависимостей
  for (const [from, deps] of Object.entries(graph)) {
    for (const dep of deps) {
      if (inwardDeps[from]) inwardDeps[from].push(dep);
      if (outwardDeps[dep]) outwardDeps[dep].push(from);
    }
  }

  // Находим entry функции
  const entryFunctions: string[] = [];
  const rootEntities = entitiesMap[rootKey];
  if (rootEntities) {
    for (const func of rootEntities.functions) {
      if (func.isExported) entryFunctions.push(func.name);
    }
  }

  // Строим executionFlow
  const executionSteps: EnhancedPackageLockReport['executionGraph']['executionFlow']['steps'] = [];
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

  // Собираем статистику по файлам
  let totalFiles = 0;
  let totalSize = 0;
  let totalLines = 0;

  for (const filePath of filePaths) {
    const absPath = findFileInProject(filePath, projectRoot);
    if (absPath && fs.existsSync(absPath)) {
      totalFiles++;
      try {
        const content = fs.readFileSync(absPath, 'utf-8');
        totalSize += content.length;
        totalLines += content.split('\n').length;
      } catch (error) {
        // Игнорируем ошибки чтения файлов
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
    callGraph,
    entityStats: {
      totalFunctions,
      totalConstants,
      totalVariables,
      totalInterfaces,
      totalTypes,
      totalClasses,
      totalCalls, // ✅ ТЕПЕРЬ ПРАВИЛЬНО
      totalExportedFunctions,
      totalAsyncFunctions,
    },
    fileStats: {
      totalFiles,
      totalSize,
      totalLines,
    },
    timestamp: new Date().toISOString(),
  };
}

// ============================================================
// НОВАЯ ФУНКЦИЯ: convertToEnhancedEntityInfo
// ============================================================

/**
 * Преобразует EntitiesResult в EnhancedEntityInfo
 */
function convertToEnhancedEntityInfo(entities: EntitiesResult): EnhancedEntityInfo {
  return {
    functions: entities.functions.map(f => ({
      name: f.name,
      params: f.params,
      paramTypes: f.params.map(() => 'any'),
      line: f.line,
      startLine: f.startLine,
      endLine: f.endLine,
      isAsync: f.isAsync,
      isExported: f.isExported,
      isMethod: f.isMethod || false,
      className: f.className,
      calls: f.calls || [],
      calledBy: f.calledBy || [],
      returnType: f.returnType || 'any',
      body: f.body || '',
    })),
    constants: entities.constants.map(c => ({
      name: c.name,
      value: c.value,
      line: c.line,
      isExported: c.isExported,
      type: c.type,
    })),
    variables: entities.variables.map(v => ({
      name: v.name,
      value: v.value,
      line: v.line,
      isExported: v.isExported,
      type: v.type,
    })),
    interfaces: entities.interfaces.map(i => ({
      name: i.name,
      properties: i.properties,
      line: i.line,
      isExported: i.isExported,
      extends: i.extends,
      startLine: i.startLine,
      endLine: i.endLine,
    })),
    types: entities.types.map(t => ({
      name: t.name,
      definition: t.definition,
      line: t.line,
      isExported: t.isExported,
    })),
    classes: entities.classes.map(c => ({
      name: c.name,
      methods: c.methods,
      properties: c.properties,
      line: c.line,
      isExported: c.isExported,
      extends: c.extends,
      implements: c.implements,
      startLine: c.startLine,
      endLine: c.endLine,
    })),
  };
}

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

/**
 * Находит модуль для сущности
 */
function findModuleForEntity(entityName: string, data: GraphData): string | null {
  for (const [modulePath, deps] of Object.entries(data.graph)) {
    if (modulePath.includes(entityName)) return modulePath;
    for (const dep of deps) {
      if (dep.includes(entityName)) return dep;
    }
  }
  const baseName = entityName.replace(/\.[^.]+$/, '');
  for (const [modulePath, deps] of Object.entries(data.graph)) {
    if (modulePath.includes(baseName)) return modulePath;
    for (const dep of deps) {
      if (dep.includes(baseName)) return dep;
    }
  }
  return null;
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default {
  saveModuleGraph,
  saveEntityGraph,
  saveFullAnalysis,
  savePackageLockReport,
  saveCallGraphResult,
  buildModuleGraph,
  buildEntityGraph,
  buildFullAnalysis,
  extractEntitiesFromFile,
  buildEnhancedPackageLockReport,
};