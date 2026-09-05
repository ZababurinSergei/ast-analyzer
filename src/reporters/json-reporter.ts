// src/reporters/json-reporter.ts
// ОБНОВЛЕННАЯ ВЕРСИЯ - использует analyzers модуль
// Полностью очищена от дублирующихся анализаторов

import fs from 'fs';
import path from 'path';
import { Project, Node } from 'ts-morph';

import type {
  GraphData,
  FullAnalysis,
  ArchitectureMetrics,
  ProjectSummary,
  VueAnalysis,
  OptimizedReportOptions,
  ExtendedFunctionInfo,
  CallInfo,
  CalledByInfo,
  ImportedByInfo,
  EntitiesResult,
  FunctionInfo,
  ClassInfo,
  ConstantInfo,
  InterfaceInfo,
  TypeInfo,
  VariableInfo,
  ImportInfo,
  ExportInfo,
} from '../types.js';

import type {
  EnhancedPackageLockReport,
  EnhancedEntityInfo,
  PackageLockImportInfo,
  EnhancedFunctionInfo,
  FunctionEntity,
  EntityStats,
  FileStats,
  EnhancedPackageInfo,
  CallGraphResult,
} from './modules/types.js';

import type {
  ModuleNode,
  ModuleEdge,
  ModuleGraph,
  EntityNode,
  EntityEdge,
  EntityGraph,
} from './modules/types.js';

import type { CompactReport, CompactModule, CompactFunction } from '../types.js';

import {
  ensureArray,
  safeString,
  safeNumber,
  safeBoolean,
  isRealObject,
  filterRealObjects,
  sanitizeEntities,
  safeTraverseAST,
  findProjectRoot,
  findFileInProject,
  findModuleForEntity,
} from './modules/utils.js';

import {
  createMetadata,
  getReportName,
  getReportVersion,
  getLockfileVersion,
} from './modules/metadata.js';

import { calculateEntityStats, calculateFileStats } from './modules/statistics.js';

import {
  buildDependencyGraph,
  findCycles,
  getMaxDepth,
  getModulesByLevel,
} from './modules/graphs.js';

import { buildExecutionGraph, buildImportExportFlow } from './modules/flows.js';

import { buildArchitectureMetrics } from './modules/architecture.js';

import { buildSummary } from './modules/summary.js';

import { buildPackages } from './modules/packages.js';

// ✅ Импортируем idManager для генерации ID
import idManager from '../core/IdManager.js';

// ✅ Импортируем анализаторы из единого модуля
import {
  extractDynamicImports,
  extractConfigRefs,
  extractExternalLibs,
  extractVueTemplates,
  extractAsyncChains,
  extractClosures,
  extractTypeDeps,
  analyzeContent,
} from '../analyzers/index.js';

// ============================================================
// КЭШИРОВАНИЕ РЕЗУЛЬТАТОВ
// ============================================================

interface CacheEntry {
  data: any;
  timestamp: number;
  hash: string;
}

export class AnalysisCache {
  private cache = new Map<string, CacheEntry>();
  private TTL = 5 * 60 * 1000; // 5 минут
  private maxEntries = 100;

  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.TTL) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  set(key: string, data: any): void {
    if (this.cache.size >= this.maxEntries) {
      const oldest = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)
        .slice(0, Math.floor(this.maxEntries * 0.2));
      for (const [k] of oldest) {
        this.cache.delete(k);
      }
    }

    const hash = this.generateHash(data);
    this.cache.set(key, { data, timestamp: Date.now(), hash });
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  getStats(): { total: number; oldest: number; newest: number } {
    const entries = Array.from(this.cache.values());
    if (entries.length === 0) {
      return { total: 0, oldest: 0, newest: 0 };
    }
    const timestamps = entries.map(e => e.timestamp);
    return {
      total: entries.length,
      oldest: Math.min(...timestamps),
      newest: Math.max(...timestamps),
    };
  }

  private generateHash(data: any): string {
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }
}

export const analysisCache = new AnalysisCache();

// ============================================================
// МИГРАЦИЯ ДАННЫХ
// ============================================================

export class DataMigrator {
  private migrations = new Map<string, (data: any) => any>();

  constructor() {
    this.migrations.set('4.0.0', this.migrateToV4);
    this.migrations.set('5.0.0', this.migrateToV5);
    this.migrations.set('5.1.0', this.migrateToV51);
  }

  migrate(data: any): any {
    const version = data.version || '4.0.0';
    const migration = this.migrations.get(version);
    if (migration) {
      return migration(data);
    }
    return data;
  }

  private migrateToV4(data: any): any {
    if (!data.st) data.st = {};
    if (!data.st.tsf) data.st.tsf = 0;
    if (!data.st.tcn) data.st.tcn = 0;
    if (!data.st.tuc) data.st.tuc = 0;
    if (!data.st.tcd) data.st.tcd = 0;
    return data;
  }

  private migrateToV5(data: any): any {
    if (!data.gr) data.gr = {};
    if (!data.gr.di) data.gr.di = [];
    if (!data.gr.cfg) data.gr.cfg = [];
    if (!data.gr.ext) data.gr.ext = [];
    if (!data.gr.vt) data.gr.vt = [];
    if (!data.gr.async) data.gr.async = [];
    if (!data.gr.closures) data.gr.closures = [];
    if (!data.gr.types) data.gr.types = [];
    return data;
  }

  private migrateToV51(data: any): any {
    if (!data.sf) data.sf = [];
    if (!data.st) data.st = {};
    if (!data.st.tsf) data.st.tsf = data.sf.length || 0;

    if (!data.legend) {
      data.legend = {
        callTypes: {
          d: 'direct',
          a: 'async',
          m: 'method',
          c: 'callback',
          di: 'dynamic-import',
        },
        importTypes: {
          n: 'named',
          df: 'default',
          ns: 'namespace',
          ri: 're-export',
          to: 'type-only',
          se: 'side-effect',
        },
        dynamicImportTypes: {
          t: 'template-literal',
          v: 'variable',
          c: 'conditional',
        },
      };
    }

    return data;
  }
}

export const migrator = new DataMigrator();

// ============================================================
// ЭКСПОРТ ВСЕХ ТИПОВ
// ============================================================

export type {
  GraphData,
  EntitiesResult,
  EnhancedEntityInfo,
  EnhancedPackageLockReport,
  EnhancedPackageInfo,
  PackageLockImportInfo,
  ModuleNode,
  ModuleEdge,
  ModuleGraph,
  EntityNode,
  EntityEdge,
  EntityGraph,
  FullAnalysis,
  ArchitectureMetrics,
  ProjectSummary,
  VueAnalysis,
  FunctionEntity,
  OptimizedReportOptions,
  ExtendedFunctionInfo,
  CallInfo,
  CalledByInfo,
  ImportedByInfo,
  EnhancedFunctionInfo,
  FunctionInfo,
  ClassInfo,
  ConstantInfo,
  InterfaceInfo,
  TypeInfo,
  VariableInfo,
  ImportInfo,
  ExportInfo,
  CompactReport,
  CompactModule,
  CompactFunction,
  EntityStats,
  FileStats,
  CallGraphResult,
};

// ============================================================
// ЭКСПОРТ ВСЕХ ФУНКЦИЙ (кроме анализаторов - они в analyzers/)
// ============================================================

export {
  ensureArray,
  safeString,
  safeNumber,
  safeBoolean,
  isRealObject,
  filterRealObjects,
  sanitizeEntities,
  safeTraverseAST,
  findProjectRoot,
  findFileInProject,
  findModuleForEntity,
} from './modules/utils.js';

export {
  createMetadata,
  getReportName,
  getReportVersion,
  getLockfileVersion,
} from './modules/metadata.js';

export { calculateEntityStats, calculateFileStats } from './modules/statistics.js';

export {
  buildDependencyGraph,
  findCycles,
  getMaxDepth,
  getModulesByLevel,
} from './modules/graphs.js';

export { buildExecutionGraph, buildImportExportFlow } from './modules/flows.js';

export { buildArchitectureMetrics } from './modules/architecture.js';

export { buildSummary } from './modules/summary.js';

export { buildPackages } from './modules/packages.js';

// ============================================================
// РЕЭКСПОРТ АНАЛИЗАТОРОВ ИЗ analyzers МОДУЛЯ
// ============================================================

export {
  extractDynamicImports,
  extractConfigRefs,
  extractExternalLibs,
  extractVueTemplates,
  extractAsyncChains,
  extractClosures,
  extractTypeDeps,
  analyzeContent,
  type AnalysisResult,
  type DynamicImport,
  type ConfigRef,
  type ExternalLib,
  type VueTemplate,
  type AsyncChain,
  type Closure,
  type TypeDep,
} from '../analyzers/index.js';

// ============================================================
// extractEntitiesFromFile - ОСНОВНАЯ ФУНКЦИЯ
// ============================================================

export function extractEntitiesFromFile(filePath: string): EnhancedEntityInfo {
  // Проверяем кэш
  const cacheKey = `entities:${filePath}`;
  const cached = analysisCache.get(cacheKey);
  if (cached) {
    console.log(`📦 Использован кэш для: ${path.basename(filePath)}`);
    return cached;
  }

  const entities: EnhancedEntityInfo = {
    functions: [],
    constants: [],
    variables: [],
    interfaces: [],
    types: [],
    classes: [],
    imports: [],
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

    const content = sourceFile.getText();

    // ============================================================
    // ИСПОЛЬЗУЕМ analyzeContent ИЗ analyzers МОДУЛЯ
    // ============================================================

    const analysis = analyzeContent(content, absolutePath, {
      includeDynamicImports: true,
      includeConfigRefs: true,
      includeExternalLibs: true,
      includeVueTemplates: true,
      includeAsyncChains: true,
      includeClosures: true,
      includeTypeDeps: true,
    });

    // Добавляем результаты анализа в entities
    if (analysis.dynamicImports.length > 0) {
      (entities as any).dynamicImports = analysis.dynamicImports;
    }

    if (analysis.configRefs.length > 0) {
      (entities as any).configRefs = analysis.configRefs;
    }

    if (analysis.externalLibs.length > 0) {
      (entities as any).externalLibs = analysis.externalLibs;
    }

    if (analysis.vueTemplates.length > 0) {
      (entities as any).vueTemplates = analysis.vueTemplates;
    }

    if (analysis.asyncChains.length > 0) {
      (entities as any).asyncChains = analysis.asyncChains;
    }

    if (analysis.closures.length > 0) {
      (entities as any).closures = analysis.closures;
    }

    if (analysis.typeDeps.length > 0) {
      (entities as any).typeDeps = analysis.typeDeps;
    }

    // ============================================================
    // ИЗВЛЕЧЕНИЕ ИМПОРТОВ
    // ============================================================

    const importedNames = new Set<string>();
    try {
      const importDeclarations = sourceFile.getImportDeclarations();
      for (const imp of importDeclarations) {
        const moduleSpecifier = imp.getModuleSpecifierValue();
        const specifiers: string[] = [];

        const namedImports = imp.getNamedImports();
        for (const named of namedImports) {
          const name = named.getName();
          specifiers.push(name);
          importedNames.add(name);
        }

        const defaultImport = imp.getDefaultImport();
        if (defaultImport) {
          const name = defaultImport.getText();
          specifiers.unshift(`default as ${name}`);
          importedNames.add(name);
        }

        const namespaceImport = imp.getNamespaceImport();
        if (namespaceImport) {
          const name = namespaceImport.getText();
          specifiers.push(`* as ${name}`);
        }

        if (moduleSpecifier && specifiers.length > 0) {
          entities.imports!.push({
            source: moduleSpecifier,
            specifiers: specifiers,
            isTypeOnly: false,
          });
        }
      }
    } catch (error) {
      console.warn('⚠️ Ошибка при извлечении импортов:', error);
    }

    // ============================================================
    // ИЗВЛЕЧЕНИЕ ФУНКЦИЙ
    // ============================================================

    const functions = sourceFile.getFunctions();
    for (const functionDecl of functions) {
      const name = functionDecl.getName();
      if (!name) continue;

      const params = functionDecl.getParameters().map((p: any) => p.getName());
      const returnType = functionDecl.getReturnType().getText();
      const isAsync = functionDecl.isAsync();
      const isExported = functionDecl.isExported();

      const calls: string[] = [];
      functionDecl.forEachDescendant((node: any) => {
        if (Node.isCallExpression(node)) {
          const expr = node.getExpression();
          if (Node.isIdentifier(expr)) {
            const calledName = expr.getText();
            if (calledName && calledName !== name && !importedNames.has(calledName)) {
              calls.push(calledName);
            }
          }
        }
      });

      let complexity = 1;
      try {
        functionDecl.forEachDescendant((node: any) => {
          const kind = node.getKind();
          if ([95, 96, 97, 98, 129, 130, 131, 132].includes(kind)) {
            complexity++;
          }
        });
      } catch {
        complexity = 1;
      }

      const bodyText = functionDecl.getBody()?.getText() || '';
      const security = {
        hasEval: bodyText.includes('eval(') || bodyText.includes('eval ('),
        hasProcessEnv: bodyText.includes('process.env'),
        hasSensitiveData:
          /['\"][a-zA-Z0-9_\-]{32,}['\"]/.test(bodyText) ||
          /'\"sk-[a-zA-Z0-9]{20,}['\"]/.test(bodyText),
        hasExec: bodyText.includes('exec(') || bodyText.includes('exec ('),
        hasPassword: /\b(password|passwd|pwd|secret|token|api[_-]?key)\b/i.test(bodyText),
      };

      const moduleName = path.basename(path.dirname(absolutePath));

      const hasCalls = calls.length > 0;
      const hasCalledBy = false;
      const isSelf = !hasCalls && !hasCalledBy;

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
        className: '',
        calls: [...new Set(calls)],
        calledBy: [],
        returnType,
        body: bodyText,
        isNested: false,
        parentFunction: '',
        isArrow: false,
        isEventHandler: false,
        eventType: '',
        depth: 0,
        complexity,
        security,
        vscode: `vscode://file/${absolutePath}:${functionDecl.getStartLineNumber()}`,
        signature: '',
        _safeInfo: null,
        filePath: absolutePath,
        moduleName: moduleName,
        _modulePath: path.dirname(absolutePath),
        id: idManager.generateCompactId({
          filePath: absolutePath,
          funcName: name,
          line: functionDecl.getStartLineNumber(),
          parentFunction: undefined,
          depth: 0,
        }),
        isSelf: isSelf,
        _isSelf: isSelf,
      });
    }

    // ============================================================
    // ИЗВЛЕЧЕНИЕ СТРЕЛОЧНЫХ ФУНКЦИЙ
    // ============================================================

    const variableDeclarations = sourceFile.getVariableDeclarations();
    for (const decl of variableDeclarations) {
      const name = decl.getName();
      const initializer = decl.getInitializer();

      if (initializer && Node.isArrowFunction(initializer)) {
        const isExported = decl.isExported();
        const params = initializer.getParameters().map((p: any) => p.getName());
        const returnType = initializer.getReturnType().getText();
        const isAsync = initializer.isAsync();

        const existing = entities.functions.find((f: any) => f.name === name);
        if (!existing) {
          const calls: string[] = [];
          initializer.forEachDescendant((node: any) => {
            if (Node.isCallExpression(node)) {
              const expr = node.getExpression();
              if (Node.isIdentifier(expr)) {
                const calledName = expr.getText();
                if (calledName && calledName !== name && !importedNames.has(calledName)) {
                  calls.push(calledName);
                }
              }
            }
          });

          const bodyText = initializer.getBody()?.getText() || '';
          const security = {
            hasEval: bodyText.includes('eval(') || bodyText.includes('eval ('),
            hasProcessEnv: bodyText.includes('process.env'),
            hasSensitiveData:
              /['\"][a-zA-Z0-9_\-]{32,}['\"]/.test(bodyText) ||
              /'\"sk-[a-zA-Z0-9]{20,}['\"]/.test(bodyText),
            hasExec: bodyText.includes('exec(') || bodyText.includes('exec ('),
            hasPassword: /\b(password|passwd|pwd|secret|token|api[_-]?key)\b/i.test(bodyText),
          };

          let complexity = 1;
          try {
            initializer.forEachDescendant((node: any) => {
              const kind = node.getKind();
              if ([95, 96, 97, 98, 129, 130, 131, 132].includes(kind)) {
                complexity++;
              }
            });
          } catch {
            complexity = 1;
          }

          const moduleName = path.basename(path.dirname(absolutePath));

          const hasCalls = calls.length > 0;
          const isSelf = !hasCalls;

          entities.functions.push({
            name,
            params,
            paramTypes: params.map(() => 'any'),
            line: decl.getStartLineNumber(),
            startLine: decl.getStartLineNumber(),
            endLine: initializer.getEndLineNumber(),
            isAsync,
            isExported,
            isMethod: false,
            className: '',
            calls: [...new Set(calls)],
            calledBy: [],
            returnType,
            body: bodyText,
            isNested: false,
            parentFunction: '',
            isArrow: true,
            isEventHandler: false,
            eventType: '',
            depth: 0,
            complexity,
            security,
            vscode: `vscode://file/${absolutePath}:${decl.getStartLineNumber()}`,
            signature: '',
            _safeInfo: null,
            filePath: absolutePath,
            moduleName: moduleName,
            _modulePath: path.dirname(absolutePath),
            id: idManager.generateCompactId({
              filePath: absolutePath,
              funcName: name,
              line: decl.getStartLineNumber(),
              parentFunction: undefined,
              depth: 0,
            }),
            isSelf: isSelf,
            _isSelf: isSelf,
          });

          const constIndex = entities.constants.findIndex((c: any) => c.name === name);
          if (constIndex !== -1) {
            entities.constants.splice(constIndex, 1);
          }
        }
      }
    }

    // ============================================================
    // ИЗВЛЕЧЕНИЕ КОНСТАНТ И ПЕРЕМЕННЫХ
    // ============================================================

    for (const decl of variableDeclarations) {
      const name = decl.getName();
      const initializer = decl.getInitializer();

      const isArrowFunction = initializer && Node.isArrowFunction(initializer);
      if (isArrowFunction) continue;

      const isConst = decl.getVariableStatement()?.getDeclarationKind() === 'const';

      const info = {
        name,
        line: decl.getStartLineNumber(),
        isExported: decl.isExported(),
        type: initializer ? initializer.getType().getText() : 'any',
        value: initializer ? extractValueFromNode(initializer) : undefined,
        _safeInfo: null,
      };

      if (isConst) {
        entities.constants.push(info);
      } else {
        entities.variables.push(info);
      }
    }

    // ============================================================
    // ИЗВЛЕЧЕНИЕ КЛАССОВ
    // ============================================================

    const classes = sourceFile.getClasses();
    for (const cls of classes) {
      const name = cls.getName();
      if (!name) continue;

      const methods: string[] = [];
      const properties: string[] = [];

      for (const method of cls.getMethods()) {
        const methodName = method.getName();
        if (methodName) {
          methods.push(methodName);
        }
      }

      for (const prop of cls.getProperties()) {
        const propName = prop.getName();
        if (propName) {
          properties.push(propName);
        }
      }

      entities.classes.push({
        name,
        methods,
        properties,
        line: cls.getStartLineNumber(),
        startLine: cls.getStartLineNumber(),
        endLine: cls.getEndLineNumber(),
        isExported: cls.isExported(),
        extends: cls.getExtends()?.getText(),
        implements: cls.getImplements().map((i: any) => i.getText()),
        _safeInfo: null,
      });
    }

    // ============================================================
    // ИЗВЛЕЧЕНИЕ ИНТЕРФЕЙСОВ
    // ============================================================

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
        extends: intf.getExtends().map((e: any) => e.getText()),
        _safeInfo: null,
      });
    }

    // ============================================================
    // ИЗВЛЕЧЕНИЕ ТИПОВ
    // ============================================================

    const typeAliases = sourceFile.getTypeAliases();
    for (const typeAlias of typeAliases) {
      const name = typeAlias.getName();
      if (!name) continue;

      entities.types.push({
        name,
        definition: typeAlias.getType().getText(),
        line: typeAlias.getStartLineNumber(),
        isExported: typeAlias.isExported(),
        _safeInfo: null,
      });
    }

    const relativePath = path.relative(process.cwd(), absolutePath);
    console.log(`✅ Извлечено сущностей из ${relativePath}:`);
    console.log(`   Функций: ${entities.functions.length}`);
    console.log(`   Классов: ${entities.classes.length}`);
    console.log(`   Констант: ${entities.constants.length}`);
    console.log(`   Интерфейсов: ${entities.interfaces.length}`);
    console.log(`   Типов: ${entities.types.length}`);
    console.log(`   Переменных: ${entities.variables.length}`);
    console.log(`   Импортов: ${entities.imports?.length || 0}`);

    // Статистика по новым анализаторам
    const diCount = (entities as any).dynamicImports?.length || 0;
    const cfgCount = (entities as any).configRefs?.length || 0;
    const extCount = (entities as any).externalLibs?.length || 0;
    const vtCount = (entities as any).vueTemplates?.length || 0;
    const asyncCount = (entities as any).asyncChains?.length || 0;
    const closureCount = (entities as any).closures?.length || 0;
    const typeCount = (entities as any).typeDeps?.length || 0;

    if (diCount + cfgCount + extCount + vtCount + asyncCount + closureCount + typeCount > 0) {
      console.log(`   📊 Расширенный анализ (из analyzers модуля):`);
      if (diCount) console.log(`      Динамических импортов: ${diCount}`);
      if (cfgCount) console.log(`      Конфигураций: ${cfgCount}`);
      if (extCount) console.log(`      Внешних библиотек: ${extCount}`);
      if (vtCount) console.log(`      Vue компонентов: ${vtCount}`);
      if (asyncCount) console.log(`      Асинхронных цепочек: ${asyncCount}`);
      if (closureCount) console.log(`      Замыканий: ${closureCount}`);
      if (typeCount) console.log(`      Типовых зависимостей: ${typeCount}`);
    }

    // Сохраняем в кэш
    analysisCache.set(cacheKey, entities);

    return entities;
  } catch (error: any) {
    console.error(
      `❌ Ошибка при извлечении сущностей из ${absolutePath}:`,
      error?.message || String(error)
    );
    return entities;
  }
}

function extractValueFromNode(node: any): any {
  try {
    const text = node.getText();

    if (
      (text.startsWith('"') && text.endsWith('"')) ||
      (text.startsWith("'") && text.endsWith("'"))
    ) {
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
      return node.getElements().map((e: any) => extractValueFromNode(e));
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
  } catch {
    return undefined;
  }
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default {
  extractEntitiesFromFile,
  AnalysisCache,
  analysisCache,
  DataMigrator,
  migrator,
  // Реэкспорт анализаторов из analyzers модуля
  extractDynamicImports,
  extractConfigRefs,
  extractExternalLibs,
  extractVueTemplates,
  extractAsyncChains,
  extractClosures,
  extractTypeDeps,
  analyzeContent,
  metadata: {
    createMetadata,
    getReportName,
    getReportVersion,
    getLockfileVersion,
  },
  statistics: {
    calculateEntityStats,
    calculateFileStats,
  },
  graphs: {
    buildDependencyGraph,
    findCycles,
    getMaxDepth,
    getModulesByLevel,
  },
  flows: {
    buildExecutionGraph,
    buildImportExportFlow,
  },
  architecture: {
    buildArchitectureMetrics,
  },
  summary: {
    buildSummary,
  },
  packages: {
    buildPackages,
  },
  utils: {
    ensureArray,
    safeString,
    safeNumber,
    safeBoolean,
    isRealObject,
    filterRealObjects,
    sanitizeEntities,
    safeTraverseAST,
    findProjectRoot,
    findFileInProject,
    findModuleForEntity,
  },
};
