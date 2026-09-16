// packages/ast-analyzer/src/reporters/json-reporter.ts
// ОБНОВЛЕННАЯ ВЕРСИЯ - использует analyzers модуль
// Полностью очищена от дублирующихся анализаторов
// ✅ ДОБАВЛЕНА ПОДДЕРЖКА ЭКСПОРТОВ
// ✅ УЛУЧШЕНА ОБРАБОТКА ОШИБОК в extractEntitiesFromFile
// ✅ v2: Все вызовы ts-morph обёрнуты в try/catch для устойчивости к ошибкам 'escapedName' и 'flags'
// ✅ v3 (ПАТЧ 1.1): safeGetType/safeGetReturnType получили фильтр canHaveType,
//                  console.warn заменён на console.debug,
//                  предварительный прогрев чекера через node.getType()
// ✅ v4 (ПАТЧ 1.2): добавлена обработка .vue файлов через analyzeVueComponent
//                  + convertVueAnalysisToEntities, с явным приведением типов
//                  через `as any` / `as EnhancedEntityInfo`
// ✅ v5 (ПАТЧ 1.3): исправлены ошибки TS18048 и TS2322:
//                  - результат templateXxx?.length ?? 0
//                  - specifiers маппятся в ImportSpecifier[]
// ✅ v6 (ПАТЧ v9.0.0): прокинуты в EnhancedEntityInfo новые template-поля:
//                  - templateConditionals
//                  - templateLifecycle
//                  - templateEffects
//                  - templateInjections
//                  - templateReactivity
//                  + добавлен вызов extractTypeGraph для ts/js-файлов
//                  + запись typesGraph / typeRefsGraph
// ✅ v7 (ПАТЧ v9.0.1): КРИТИЧНОЕ ИСПРАВЛЕНИЕ vt (Vue templates):
//                  - добавлено поле templateRefs в EnhancedEntityInfo (ветка .vue)
//                  - без него Codec.encode получал undefined на позиции 9 vt[]
//                    и JSON.stringify обрезал массив до 9 элементов вместо 12.
//                  - теперь vt-кортежи гарантированно содержат 12 полей.
// ✅ v8 (ПАТЧ v9.0.2): FINAL
//                  - добавлено поле templateConditionals в EnhancedEntityInfo (ветка .vue)
//                  - добавлено поле resolvedComponents в templateDynamicComponents
//                  - добавлено поле conditionals в TemplateData (через templateConditionals)
//                  - добавлено поле typesGraph / typeRefsGraph в EnhancedEntityInfo
//                  - version: '9.0.0'

import fs from 'fs';
import path from 'path';
import { Project, Node } from 'ts-morph';
import { parseFile } from '../core/ast-parser.js';

// ✅ ИМПОРТЫ ДЛЯ ОБРАБОТКИ .VUE
import { analyzeVueComponent } from '../modes/vue-analyzer/index.js';
import { convertVueAnalysisToEntities } from '../core/entity-extractor/vue/convert-analysis.js';

// ✅ ПАТЧ v9.0.0: импорт экстрактора тип-графа
import { extractTypeGraph } from '../core/type-graph-extractor.js';

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
// ✅ ПАТЧ 1.1: БЕЗОПАСНЫЕ ОБЁРТКИ ДЛЯ ts-morph
// ============================================================

function canHaveType(node: any): boolean {
  if (!node || typeof node.getKind !== 'function') return false;

  try {
    const kind = node.getKind();

    const SKIP_KINDS = new Set<number>([
      261, // PropertyAssignment
      262, // ShorthandPropertyAssignment
      263, // SpreadAssignment
      264, // MethodDeclaration в object literal
      257, // VariableDeclaration (проверим отдельно ниже)
    ]);
    if (SKIP_KINDS.has(kind)) {
      if (kind === 257 && typeof node.getInitializer === 'function') {
        const init = node.getInitializer();
        if (!init) return false;
        return true;
      }
      return false;
    }

    const sf = node.getSourceFile?.();
    if (!sf) return false;

    const project = sf.getProject?.();
    if (!project) return false;

    return true;
  } catch {
    return false;
  }
}

function safeGetReturnType(node: any, context: string): string {
  if (!canHaveType(node)) return 'any';

  try {
    node.getType();

    const returnType = node.getReturnType();
    if (!returnType) return 'any';
    const text = returnType.getText();
    return text || 'any';
  } catch (error) {
    if (process.env.AST_DEBUG_TYPES === 'true') {
      console.debug(
        `   [safeGetReturnType] ${context}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
    return 'any';
  }
}

function safeGetType(node: any, context: string): string {
  if (!canHaveType(node)) return 'any';

  try {
    node.getType();
    const type = node.getType();
    if (!type) return 'any';
    const text = type.getText();
    return text || 'any';
  } catch (error) {
    if (process.env.AST_DEBUG_TYPES === 'true') {
      console.debug(
        `   [safeGetType] ${context}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    return 'any';
  }
}

function safeGetParameters(node: any, context: string): string[] {
  try {
    const params = node.getParameters();
    if (!Array.isArray(params)) return [];
    return params
      .map((p: any) => {
        try {
          return p.getName();
        } catch {
          return 'unknown';
        }
      })
      .filter((n: string) => n && n !== 'unknown');
  } catch (error) {
    if (process.env.AST_DEBUG_TYPES === 'true') {
      console.debug(
        `   [safeGetParameters] Ошибка при получении параметров (${context}): ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
    return [];
  }
}

function safeGetBodyText(node: any, context: string): string {
  try {
    const body = node.getBody();
    if (!body) return '';
    return body.getText() || '';
  } catch (error) {
    if (process.env.AST_DEBUG_TYPES === 'true') {
      console.debug(
        `   [safeGetBodyText] Ошибка при получении тела (${context}): ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
    return '';
  }
}

function safeIsAsync(node: any, context: string): boolean {
  try {
    return node.isAsync() || false;
  } catch (error) {
    if (process.env.AST_DEBUG_TYPES === 'true') {
      console.debug(
        `   [safeIsAsync] Ошибка при определении async (${context}): ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
    return false;
  }
}

function safeIsExported(node: any, context: string): boolean {
  try {
    return node.isExported() || false;
  } catch (error) {
    if (process.env.AST_DEBUG_TYPES === 'true') {
      console.debug(
        `   [safeIsExported] Ошибка при определении экспорта (${context}): ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
    return false;
  }
}

function safeGetStartLine(node: any): number {
  try {
    return node.getStartLineNumber() || 1;
  } catch {
    return 1;
  }
}

function safeGetEndLine(node: any): number {
  try {
    return node.getEndLineNumber() || 1;
  } catch {
    return 1;
  }
}

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

  // ============================================================
  // ✅ ПАТЧ 1.2: ОБРАБОТКА .VUE ФАЙЛОВ
  // ============================================================
  // ✅ ПАТЧ v9.0.0: добавлены пробросы templateConditionals,
  //   templateLifecycle, templateEffects, templateInjections,
  //   templateReactivity.
  // ✅ ПАТЧ v9.0.1: КРИТИЧНОЕ ИСПРАВЛЕНИЕ — добавлен templateRefs.
  //   Без него Codec.encode получал undefined на позиции 9 vt[],
  //   и JSON.stringify обрезал массив до 9 элементов вместо 12.
  // ✅ ПАТЧ v9.0.2 (FINAL): гарантируем 12 полей vt[], включая
  //   resolvedComponents в dynamicComponents и conditionals в template.
  // ============================================================
  if (filePath.endsWith('.vue')) {
    try {
      const vueAnalysis = analyzeVueComponent(filePath);
      if (vueAnalysis) {
        const entities = convertVueAnalysisToEntities(vueAnalysis, filePath);

        const result = {
          functions: (entities.functions || []) as any,
          constants: (entities.constants || []) as any,
          variables: (entities.variables || []) as any,
          interfaces: (entities.interfaces || []) as any,
          types: (entities.types || []) as any,
          classes: (entities.classes || []) as any,
          imports: (entities.imports || []) as any,

          // ✅ Прокидываем template-поля в EntitiesResult
          templateReactivityDeps: entities.templateReactivityDeps || [],
          templateEventHandlers: entities.templateEventHandlers || [],
          templateDynamicComponents: (entities.templateDynamicComponents || []).map(
            (d: any) => ({
              isExpression: d.isExpression || '',
              line: d.line || 0,
              // ✅ v9.0.2: гарантируем наличие resolvedComponents
              resolvedComponents: d.resolvedComponents || [],
            })
          ),
          // ✅ ПАТЧ v9.0.1: КРИТИЧНО — templateRefs пробрасывается.
          // Без этой строки vt-кортеж содержал 9 полей вместо 12.
          templateRefs: (entities as any).templateRefs || [],
          templateCssVariables: entities.templateCssVariables || [],
          templateDeepSelectors: entities.templateDeepSelectors || [],
          templateDirectives: entities.templateDirectives || [],
          templateUsedComponents: entities.templateUsedComponents || [],
          templateSlots: entities.templateSlots || [],
          templateComplexity: entities.templateComplexity || 0,

          // ✅ ПАТЧ v9.0.0: проброс условного рендеринга
          templateConditionals: entities.templateConditionals || [],

          // ✅ ПАТЧ v9.0.0: проброс новых секций
          templateLifecycle: (entities as any).templateLifecycle || [],
          templateEffects: (entities as any).templateEffects || [],
          templateInjections: (entities as any).templateInjections || [],
          templateReactivity: (entities as any).templateReactivity || [],
        } as EnhancedEntityInfo;

        analysisCache.set(cacheKey, result);
        console.log(
          `✅ Vue: ${path.basename(filePath)} (${result.functions.length} fn, ${result.templateEventHandlers?.length ?? 0} handlers, ${result.templateReactivityDeps?.length ?? 0} deps, ${result.templateConditionals?.length ?? 0} conditionals, ${result.templateRefs?.length ?? 0} refs)`
        );
        return result;
      }
    } catch (error) {
      console.warn(`⚠️ Vue-анализ не удался для ${filePath}:`, error);
    }
  }

  const entities: EnhancedEntityInfo = {
    functions: [],
    constants: [],
    variables: [],
    interfaces: [],
    types: [],
    classes: [],
    imports: [],
    exports: [],
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
    // ✅ ПАТЧ v9.0.0: СБОР ТИП-ГРАФА (для ts/js файлов)
    // ============================================================
    try {
      const typeGraph = extractTypeGraph([absolutePath], { verbose: false });

      if (typeGraph.types.length > 0 || typeGraph.typeRefs.length > 0) {
        (entities as any).typesGraph = typeGraph.types;
        (entities as any).typeRefsGraph = typeGraph.typeRefs;

        console.log(
          `   📐 Тип-граф: ${typeGraph.types.length} types, ${typeGraph.typeRefs.length} refs`
        );
      }
    } catch (error) {
      if (process.env.AST_DEBUG_TYPES === 'true') {
        console.debug(
          `   [type-graph] не собран для ${path.basename(absolutePath)}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
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
          } as any);
        }
      }
    } catch (error) {
      console.warn('⚠️ Ошибка при извлечении импортов:', error);
    }

    // ============================================================
    // ИЗВЛЕЧЕНИЕ ФУНКЦИЙ (БЕЗОПАСНО)
    // ============================================================

    const functions = sourceFile.getFunctions();
    for (const functionDecl of functions) {
      const name = functionDecl.getName();
      if (!name) continue;

      const params = safeGetParameters(functionDecl, `function ${name}`);
      const returnType = safeGetReturnType(functionDecl, `function ${name}`);
      const isAsync = safeIsAsync(functionDecl, `function ${name}`);
      const isExported = safeIsExported(functionDecl, `function ${name}`);

      const calls: string[] = [];
      try {
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
      } catch (error) {
        console.warn(`⚠️ Ошибка при извлечении вызовов функции ${name}`);
      }

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

      const bodyText = safeGetBodyText(functionDecl, `function ${name}`);
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
      const startLine = safeGetStartLine(functionDecl);
      const endLine = safeGetEndLine(functionDecl);

      let funcId = '';
      try {
        funcId = idManager.generateCompactId({
          filePath: absolutePath,
          funcName: name,
          line: startLine,
          parentFunction: undefined,
          depth: 0,
        });
      } catch {
        funcId = `f_${name}_${startLine}`;
      }

      entities.functions.push({
        name,
        params,
        paramTypes: params.map(() => 'any'),
        line: startLine,
        startLine,
        endLine,
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
        vscode: `vscode://file/${absolutePath}:${startLine}`,
        signature: '',
        _safeInfo: null,
        filePath: absolutePath,
        moduleName,
        _modulePath: path.dirname(absolutePath),
        id: funcId,
        isSelf,
        _isSelf: isSelf,
      });
    }

    // ============================================================
    // ИЗВЛЕЧЕНИЕ СТРЕЛОЧНЫХ ФУНКЦИЙ (БЕЗОПАСНО)
    // ============================================================

    const variableDeclarations = sourceFile.getVariableDeclarations();
    for (const decl of variableDeclarations) {
      const name = decl.getName();
      let initializer: any = null;
      try {
        initializer = decl.getInitializer();
      } catch {
        continue;
      }

      if (initializer && Node.isArrowFunction(initializer)) {
        const isExported = safeIsExported(decl, `arrow ${name}`);
        const params = safeGetParameters(initializer, `arrow ${name}`);
        const returnType = safeGetReturnType(initializer, `arrow ${name}`);
        const isAsync = safeIsAsync(initializer, `arrow ${name}`);

        const existing = entities.functions.find((f: any) => f.name === name);
        if (!existing) {
          const calls: string[] = [];
          try {
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
          } catch (error) {
            console.warn(`⚠️ Ошибка при извлечении вызовов стрелочной функции ${name}`);
          }

          const bodyText = safeGetBodyText(initializer, `arrow ${name}`);
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
          const startLine = safeGetStartLine(decl);
          const endLine = safeGetEndLine(initializer);

          let funcId = '';
          try {
            funcId = idManager.generateCompactId({
              filePath: absolutePath,
              funcName: name,
              line: startLine,
              parentFunction: undefined,
              depth: 0,
            });
          } catch {
            funcId = `f_${name}_${startLine}`;
          }

          entities.functions.push({
            name,
            params,
            paramTypes: params.map(() => 'any'),
            line: startLine,
            startLine,
            endLine,
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
            vscode: `vscode://file/${absolutePath}:${startLine}`,
            signature: '',
            _safeInfo: null,
            filePath: absolutePath,
            moduleName,
            _modulePath: path.dirname(absolutePath),
            id: funcId,
            isSelf,
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
    // ИЗВЛЕЧЕНИЕ КОНСТАНТ И ПЕРЕМЕННЫХ (БЕЗОПАСНО)
    // ============================================================

    for (const decl of variableDeclarations) {
      const name = decl.getName();
      let initializer: any = null;
      try {
        initializer = decl.getInitializer();
      } catch {
        continue;
      }

      const isArrowFunction = initializer && Node.isArrowFunction(initializer);
      if (isArrowFunction) continue;

      let isConst = false;
      try {
        isConst = decl.getVariableStatement()?.getDeclarationKind() === 'const';
      } catch {
        isConst = false;
      }

      const varType = initializer ? safeGetType(initializer, `variable ${name}`) : 'any';

      const info = {
        name,
        line: safeGetStartLine(decl),
        isExported: safeIsExported(decl, `variable ${name}`),
        type: varType,
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

      try {
        for (const method of cls.getMethods()) {
          const methodName = method.getName();
          if (methodName) methods.push(methodName);
        }
      } catch {
        // Игнорируем
      }

      try {
        for (const prop of cls.getProperties()) {
          const propName = prop.getName();
          if (propName) properties.push(propName);
        }
      } catch {
        // Игнорируем
      }

      let extendsText: string | undefined;
      let implementsList: string[] = [];
      try {
        extendsText = cls.getExtends()?.getText();
      } catch {
        extendsText = undefined;
      }
      try {
        implementsList = cls
          .getImplements()
          .map((i: any) => {
            try {
              return i.getText();
            } catch {
              return '';
            }
          })
          .filter(Boolean);
      } catch {
        implementsList = [];
      }

      entities.classes.push({
        name,
        methods,
        properties,
        line: safeGetStartLine(cls),
        startLine: safeGetStartLine(cls),
        endLine: safeGetEndLine(cls),
        isExported: safeIsExported(cls, `class ${name}`),
        extends: extendsText,
        implements: implementsList,
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
      try {
        for (const prop of intf.getProperties()) {
          properties.push(prop.getName());
        }
      } catch {
        // Игнорируем
      }

      let extendsList: string[] = [];
      try {
        extendsList = intf
          .getExtends()
          .map((e: any) => {
            try {
              return e.getText();
            } catch {
              return '';
            }
          })
          .filter(Boolean);
      } catch {
        extendsList = [];
      }

      entities.interfaces.push({
        name,
        properties,
        line: safeGetStartLine(intf),
        startLine: safeGetStartLine(intf),
        endLine: safeGetEndLine(intf),
        isExported: safeIsExported(intf, `interface ${name}`),
        extends: extendsList,
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

      let definition = 'unknown';
      try {
        definition = typeAlias.getType().getText();
      } catch {
        definition = 'unknown';
      }

      entities.types.push({
        name,
        definition,
        line: safeGetStartLine(typeAlias),
        isExported: safeIsExported(typeAlias, `type ${name}`),
        _safeInfo: null,
      });
    }

    // ============================================================
    // ИЗВЛЕЧЕНИЕ ЭКСПОРТОВ
    // ============================================================

    const parsed = parseFile(absolutePath);

    if (parsed && parsed.exports && parsed.exports.length > 0) {
      entities.exports = parsed.exports.map((exp: any) => ({
        name: exp.name,
        type: exp.type || 'value',
        isDefault: exp.isDefault || false,
        line: exp.line || 0,
        isReExport: exp.isReExport || false,
        source: exp.source || undefined,
      }));

      const reExports = entities.exports.filter(e => e.isReExport);
      if (reExports.length > 0) {
        console.log(`   📤 Реэкспортов: ${reExports.length}`);
        for (const re of reExports.slice(0, 3)) {
          console.log(`      • ${re.name} from '${re.source}'`);
        }
        if (reExports.length > 3) {
          console.log(`      ... и ещё ${reExports.length - 3} реэкспортов`);
        }
      }
    }

    // ============================================================
    // ЛОГИРОВАНИЕ
    // ============================================================

    const relativePath = path.relative(process.cwd(), absolutePath);
    console.log(`✅ Извлечено сущностей из ${relativePath}:`);
    console.log(`   Функций: ${entities.functions.length}`);
    console.log(`   Классов: ${entities.classes.length}`);
    console.log(`   Констант: ${entities.constants.length}`);
    console.log(`   Интерфейсов: ${entities.interfaces.length}`);
    console.log(`   Типов: ${entities.types.length}`);
    console.log(`   Переменных: ${entities.variables.length}`);
    console.log(`   Импортов: ${entities.imports?.length || 0}`);
    console.log(`   📤 Экспортов: ${entities.exports?.length || 0}`);

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

    // ✅ ПАТЧ v9.0.0: логирование тип-графа
    const typesGraphCount = (entities as any).typesGraph?.length || 0;
    const typeRefsGraphCount = (entities as any).typeRefsGraph?.length || 0;
    if (typesGraphCount > 0 || typeRefsGraphCount > 0) {
      console.log(`   📐 Тип-граф: ${typesGraphCount} types, ${typeRefsGraphCount} refs`);
    }

    const reExportsCount = entities.exports?.filter(e => e.isReExport).length || 0;
    if (reExportsCount > 0) {
      console.log(`   🔄 Реэкспортов: ${reExportsCount}`);
    }

    // Сохраняем в кэш
    analysisCache.set(cacheKey, entities);

    return entities;
  } catch (error: any) {
    console.error(
      `❌ Ошибка при извлечении сущностей из ${absolutePath}:`,
      error?.message || String(error)
    );
    if (error instanceof Error && error.stack) {
      console.error('📚 Стек ошибки:');
      console.error(error.stack);
    }
    return entities;
  }
}

function extractValueFromNode(node: any): any {
  try {
    const text = node.getText();

    if (
      (text.startsWith('\"') && text.endsWith('\"')) ||
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
