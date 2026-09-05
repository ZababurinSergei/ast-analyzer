// src/reporters/json-reporter.ts
// ОБНОВЛЕННАЯ ВЕРСИЯ - Все ошибки TypeScript и ESLint исправлены
// ДОБАВЛЕНЫ: кэширование, миграция данных, 7 новых анализаторов

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
    // Если превышен лимит, удаляем самые старые записи
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
      hash = ((hash << 5) - hash) + char;
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
    // Добавляем self functions если их нет
    if (!data.sf) data.sf = [];
    if (!data.st) data.st = {};
    if (!data.st.tsf) data.st.tsf = data.sf.length || 0;

    // Добавляем легенду если её нет
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
// ЭКСПОРТ ВСЕХ ФУНКЦИЙ
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
// НОВЫЕ АНАЛИЗАТОРЫ
// ============================================================

/**
 * 1. Извлечение динамических импортов: import()
 */
export function extractDynamicImports(content: string): any[] {
  const imports: any[] = [];
  const regex = /import\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const path = match[1];
    const line = content.substring(0, match.index).split('\n').length + 1;
    let type = 'literal';
    if (path && path.includes('${')) type = 'template';
    else if (path && (path.includes('+') || path.includes('?'))) type = 'conditional';
    else if (path && /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(path)) type = 'variable';

    imports.push({
      path,
      line,
      type,
      index: match.index,
    });
  }
  return imports;
}

/**
 * 2. Извлечение ссылок на конфигурации
 */
export function extractConfigRefs(content: string): any[] {
  const configs: any[] = [];
  const patterns = [
    { regex: /process\.env\.([A-Z_][A-Z0-9_]*)/g, type: 'env' },
    { regex: /require\s*\(\s*['"]([^'"]*\.config\.(js|ts|mjs|cjs))['"]\s*\)/g, type: 'require' },
    { regex: /import\s+.*\s+from\s+['"]([^'"]*\.config\.(js|ts|mjs|cjs))['"]/g, type: 'import' },
    { regex: /import\s*\(\s*['"]([^'"]*\.config\.(js|ts|mjs|cjs))['"]\s*\)/g, type: 'dynamic' },
    { regex: /(?:const|let|var)\s+config\s*=\s*require\s*\(\s*['"]([^'"]*\.config\.(js|ts))['"]\s*\)/g, type: 'require' },
  ];

  for (const { regex, type } of patterns) {
    let match;
    while ((match = regex.exec(content)) !== null) {
      const name = match[1];
      if (name) {
        const line = content.substring(0, match.index).split('\n').length + 1;
        configs.push({
          name,
          type,
          line,
          fullMatch: match[0],
        });
      }
    }
  }

  return configs;
}

/**
 * 3. Извлечение внешних библиотек
 */
export function extractExternalLibs(content: string): any[] {
  const libs: any[] = [];
  const libMap = new Map<string, { count: number; firstLine: number; imports: string[] }>();

  // Импорты
  const importRegex = /import\s+(?:type\s+)?(?:{[^}]*}|[^{}\s]+|\*\s+as\s+\w+)\s+from\s+['"]([^.'"][^'"]*)['"]/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const libName = match[1];
    if (libName && !libName.startsWith('.') && !libName.startsWith('/')) {
      const baseName = libName.split('/')[0] || libName;
      if (!libMap.has(baseName)) {
        libMap.set(baseName, { count: 0, firstLine: 0, imports: [] });
      }
      const entry = libMap.get(baseName);
      if (entry) {
        entry.count++;
        if (entry.firstLine === 0) {
          entry.firstLine = content.substring(0, match.index).split('\n').length + 1;
        }
        if (!entry.imports.includes(libName)) {
          entry.imports.push(libName);
        }
      }
    }
  }

  // require()
  const requireRegex = /(?:const|let|var)\s+\w+\s*=\s*require\s*\(\s*['"]([^.'"][^'"]*)['"]\s*\)/g;
  while ((match = requireRegex.exec(content)) !== null) {
    const libName = match[1];
    if (libName && !libName.startsWith('.') && !libName.startsWith('/')) {
      const baseName = libName.split('/')[0] || libName;
      if (!libMap.has(baseName)) {
        libMap.set(baseName, { count: 0, firstLine: 0, imports: [] });
      }
      const entry = libMap.get(baseName);
      if (entry) {
        entry.count++;
        if (entry.firstLine === 0) {
          entry.firstLine = content.substring(0, match.index).split('\n').length + 1;
        }
        if (!entry.imports.includes(libName)) {
          entry.imports.push(libName);
        }
      }
    }
  }

  for (const [name, data] of libMap) {
    libs.push({
      name,
      count: data.count,
      firstLine: data.firstLine,
      imports: data.imports,
    });
  }

  return libs.sort((a, b) => b.count - a.count);
}

/**
 * 4. Извлечение Vue шаблонов
 */
export function extractVueTemplates(content: string): any[] {
  const templates: any[] = [];

  // Извлечение компонентов из Vue шаблона
  const templateMatch = content.match(/<template>([\s\S]*?)<\/template>/);
  if (templateMatch) {
    const template = templateMatch[1];
    // const lines = template ? template.split('\n') : [];

    // Статические компоненты <ComponentName>
    const staticRegex = /<([A-Z][a-zA-Z0-9]*)/g;
    let match;
    while ((match = staticRegex.exec(template || '')) !== null) {
      const name = match[1];
      const line = template ? template.substring(0, match.index).split('\n').length + 1 : 0;
      if (name) {
        templates.push({
          name,
          type: 'static',
          line,
          fileLine: line,
        });
      }
    }

    // Динамические компоненты <component :is="...">
    const dynamicRegex = /<component\s+:is\s*=\s*["']([^"']+)["']/g;
    while ((match = dynamicRegex.exec(template || '')) !== null) {
      const name = match[1];
      const line = template ? template.substring(0, match.index).split('\n').length + 1 : 0;
      if (name) {
        templates.push({
          name,
          type: 'dynamic',
          line,
          fileLine: line,
        });
      }
    }

    // Слоты
    const slotRegex = /<slot\s+(?:name\s*=\s*["']([^"']+)["'])?/g;
    while ((match = slotRegex.exec(template || '')) !== null) {
      const name = match[1] || 'default';
      const line = template ? template.substring(0, match.index).split('\n').length + 1 : 0;
      templates.push({
        name: `slot:${name}`,
        type: 'slot',
        line,
        fileLine: line,
      });
    }

    // Директивы
    const directiveRegex = /(v-(?:if|for|show|model|on|bind))\s*[:=]/g;
    while ((match = directiveRegex.exec(template || '')) !== null) {
      const name = match[1];
      const line = template ? template.substring(0, match.index).split('\n').length + 1 : 0;
      if (name) {
        templates.push({
          name,
          type: 'directive',
          line,
          fileLine: line,
        });
      }
    }
  }

  return templates;
}

/**
 * 5. Извлечение асинхронных цепочек
 */
export function extractAsyncChains(content: string): any[] {
  const chains: any[] = [];

  // async function name() { ... }
  const asyncFuncRegex = /async\s+function\s+(\w+)\s*\([^)]*\)\s*\{([\s\S]*?)(?=\n\s*\})/g;
  let match;
  while ((match = asyncFuncRegex.exec(content)) !== null) {
    const name = match[1];
    const body = match[2] || '';
    const awaitCount = (body.match(/await/g) || []).length;
    const line = content.substring(0, match.index).split('\n').length + 1;

    // Находим цепочку await
    const awaitChain: string[] = [];
    const awaitRegex = /await\s+(\w+)\s*\(/g;
    let awaitMatch;
    while ((awaitMatch = awaitRegex.exec(body)) !== null) {
      awaitChain.push(awaitMatch[1] || '');
    }

    if (name) {
      chains.push({
        name,
        line,
        awaitCount,
        chain: awaitChain,
        hasTryCatch: body.includes('try') && body.includes('catch'),
        hasPromiseAll: body.includes('Promise.all'),
      });
    }
  }

  // const name = async () => { ... }
  const arrowRegex = /(?:const|let)\s+(\w+)\s*=\s*async\s*\([^)]*\)\s*=>\s*\{([\s\S]*?)(?=\n\s*\})/g;
  while ((match = arrowRegex.exec(content)) !== null) {
    const name = match[1];
    const body = match[2] || '';
    const awaitCount = (body.match(/await/g) || []).length;
    const line = content.substring(0, match.index).split('\n').length + 1;

    const awaitChain: string[] = [];
    const awaitRegex = /await\s+(\w+)\s*\(/g;
    let awaitMatch;
    while ((awaitMatch = awaitRegex.exec(body)) !== null) {
      awaitChain.push(awaitMatch[1] || '');
    }

    // Проверяем, не добавлена ли уже такая функция
    if (name) {
      const exists = chains.some(c => c.name === name && c.line === line);
      if (!exists) {
        chains.push({
          name,
          line,
          awaitCount,
          chain: awaitChain,
          hasTryCatch: body.includes('try') && body.includes('catch'),
          hasPromiseAll: body.includes('Promise.all'),
          isArrow: true,
        });
      }
    }
  }

  return chains;
}

/**
 * 6. Извлечение замыканий
 */
export function extractClosures(content: string): any[] {
  const closures: any[] = [];

  // Ищем функции, которые используют внешние переменные
  const funcRegex = /(?:function\s*\([^)]*\)|\([^)]*\)\s*=>)\s*\{([\s\S]*?)(?=\n\s*\})/g;
  let match;
  while ((match = funcRegex.exec(content)) !== null) {
    const body = match[1] || '';
    const start = match.index;
    const line = content.substring(0, start).split('\n').length + 1;

    // Ищем объявленные внутри переменные
    const declared = new Set<string>();
    const declRegex = /(?:var|let|const)\s+(\w+)/g;
    let declMatch;
    while ((declMatch = declRegex.exec(body)) !== null) {
      declared.add(declMatch[1] || '');
    }

    // Ищем параметры
    const paramMatch = match[0].match(/\(([^)]*)\)/);
    if (paramMatch) {
      const params = (paramMatch[1] || '').split(',').map(p => p.trim().split(':')[0]?.trim() || '').filter(Boolean);
      for (const p of params) {
        declared.add(p);
      }
    }

    // Ищем использованные внешние переменные
    const used = new Set<string>();
    const varRegex = /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\b/g;
    let varMatch;
    const reserved = new Set(['function', 'return', 'if', 'else', 'for', 'while', 'do', 'switch',
      'case', 'break', 'continue', 'throw', 'try', 'catch', 'finally', 'debugger',
      'var', 'let', 'const', 'class', 'extends', 'new', 'this', 'super', 'typeof',
      'instanceof', 'void', 'delete', 'true', 'false', 'null', 'undefined', 'NaN',
      'Infinity', 'arguments', 'eval', 'import', 'export', 'default', 'async', 'await',
      'yield', 'static', 'get', 'set', 'constructor', 'abstract', 'interface']);

    while ((varMatch = varRegex.exec(body)) !== null) {
      const name = varMatch[1];
      if (name && !declared.has(name) && !reserved.has(name)) {
        used.add(name);
      }
    }

    if (used.size > 0) {
      closures.push({
        line,
        variables: Array.from(used),
        count: used.size,
        bodyLength: body.length,
      });
    }
  }

  // Удаляем дубликаты (похожие замыкания с одинаковыми переменными)
  const unique: any[] = [];
  const seen = new Set<string>();
  for (const closure of closures) {
    const key = closure.variables.sort().join(',');
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(closure);
    }
  }

  return unique.sort((a, b) => b.count - a.count);
}

/**
 * 7. Извлечение типовых зависимостей
 */
export function extractTypeDeps(content: string): any[] {
  const deps: any[] = [];

  // Интерфейсы
  const interfaceRegex = /(?:export\s+)?interface\s+(\w+)\s*(?:<[^>]+>)?\s*(?:extends\s+([^{]+))?\s*\{/g;
  let match;
  while ((match = interfaceRegex.exec(content)) !== null) {
    const name = match[1];
    const extendsStr = match[2] || '';
    const line = content.substring(0, match.index).split('\n').length + 1;
    const isExported = content.substring(0, match.index).includes('export interface');

    const extendsList = extendsStr.split(',').map(e => e.trim()).filter(Boolean);

    if (name) {
      deps.push({
        name,
        type: 'interface',
        line,
        isExported,
        extends: extendsList,
        properties: extractInterfaceProperties(content, match.index),
      });
    }
  }

  // Type aliases
  const typeRegex = /(?:export\s+)?type\s+(\w+)\s*(?:<[^>]+>)?\s*=\s*([^;]+);/g;
  while ((match = typeRegex.exec(content)) !== null) {
    const name = match[1];
    const definition = match[2]?.trim() || '';
    const line = content.substring(0, match.index).split('\n').length + 1;
    const isExported = content.substring(0, match.index).includes('export type');

    let kind = 'alias';
    if (definition.startsWith('{')) kind = 'object';
    else if (definition.startsWith('[')) kind = 'array';
    else if (definition.includes('|')) kind = 'union';
    else if (definition.includes('&')) kind = 'intersection';
    else if (definition.includes('=>')) kind = 'function';

    if (name) {
      deps.push({
        name,
        type: 'type-alias',
        line,
        isExported,
        definition,
        kind,
      });
    }
  }

  // Generics
  const genericRegex = /<(\w+)(?:\s+extends\s+(\w+))?>/g;
  while ((match = genericRegex.exec(content)) !== null) {
    const name = match[1];
    const extendsType = match[2] || null;
    const line = content.substring(0, match.index).split('\n').length + 1;

    // Проверяем, не добавлен ли уже
    if (name) {
      const exists = deps.some(d => d.name === name && d.type === 'generic');
      if (!exists) {
        deps.push({
          name,
          type: 'generic',
          line,
          extends: extendsType,
        });
      }
    }
  }

  // Enum
  const enumRegex = /(?:export\s+)?enum\s+(\w+)\s*\{/g;
  while ((match = enumRegex.exec(content)) !== null) {
    const name = match[1];
    const line = content.substring(0, match.index).split('\n').length + 1;
    const isExported = content.substring(0, match.index).includes('export enum');

    if (name) {
      deps.push({
        name,
        type: 'enum',
        line,
        isExported,
      });
    }
  }

  return deps;
}

/**
 * Вспомогательная функция: извлечение свойств интерфейса
 */
function extractInterfaceProperties(content: string, startIndex: number): string[] {
  const properties: string[] = [];
  let braceCount = 0;
  let i = startIndex;
  let foundOpen = false;

  while (i < content.length && !foundOpen) {
    if (content[i] === '{') {
      foundOpen = true;
      braceCount = 1;
      i++;
    } else {
      i++;
    }
  }

  while (i < content.length && braceCount > 0) {
    if (content[i] === '{') braceCount++;
    if (content[i] === '}') braceCount--;

    if (braceCount === 1) {
      // Ищем свойства на текущей строке
      const lineEnd = content.indexOf('\n', i);
      const line = content.substring(i, lineEnd > 0 ? lineEnd : content.length);
      const propMatch = line.match(/^\s*(\w+)\s*(?:\?)?\s*:/);
      if (propMatch) {
        properties.push(propMatch[1] || '');
      }
    }

    i++;
    if (content[i] === '\n') i++;
  }

  return properties;
}

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
    // НОВЫЕ АНАЛИЗАТОРЫ
    // ============================================================

    // 1. Динамические импорты
    const dynamicImports = extractDynamicImports(content);
    if (dynamicImports.length > 0) {
      (entities as any).dynamicImports = dynamicImports;
    }

    // 2. Конфигурации
    const configRefs = extractConfigRefs(content);
    if (configRefs.length > 0) {
      (entities as any).configRefs = configRefs;
    }

    // 3. Внешние библиотеки
    const externalLibs = extractExternalLibs(content);
    if (externalLibs.length > 0) {
      (entities as any).externalLibs = externalLibs;
    }

    // 4. Vue шаблоны
    if (filePath.endsWith('.vue')) {
      const vueTemplates = extractVueTemplates(content);
      if (vueTemplates.length > 0) {
        (entities as any).vueTemplates = vueTemplates;
      }
    }

    // 5. Асинхронные цепочки
    const asyncChains = extractAsyncChains(content);
    if (asyncChains.length > 0) {
      (entities as any).asyncChains = asyncChains;
    }

    // 6. Замыкания
    const closures = extractClosures(content);
    if (closures.length > 0) {
      (entities as any).closures = closures;
    }

    // 7. Типовые зависимости
    const typeDeps = extractTypeDeps(content);
    if (typeDeps.length > 0) {
      (entities as any).typeDeps = typeDeps;
    }

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
      } catch (error: any) {
        complexity = 1;
      }

      const bodyText = functionDecl.getBody()?.getText() || '';
      const security = {
        hasEval: bodyText.includes('eval(') || bodyText.includes('eval ('),
        hasProcessEnv: bodyText.includes('process.env'),
        hasSensitiveData:
          /['"][a-zA-Z0-9_\-]{32,}['"]/.test(bodyText) ||
          /'"]sk-[a-zA-Z0-9]{20,}['"]/.test(bodyText),
        hasExec: bodyText.includes('exec(') || bodyText.includes('exec ('),
        hasPassword: /\b(password|passwd|pwd|secret|token|api[_-]?key)\b/i.test(bodyText),
      };

      const moduleName = path.basename(path.dirname(absolutePath));

      // Проверяем, является ли функция self (изолированной)
      const hasCalls = calls.length > 0;
      const hasCalledBy = false; // будет заполнено позже
      const isSelf = !hasCalls && !hasCalledBy;

      // Создаем объект функции без isSelf (если не определено в типе)
      const funcEntity: any = {
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
        // Поле _isSelf для внутреннего использования
        _isSelf: isSelf,
      };
      entities.functions.push(funcEntity);
    }

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
              /['"][a-zA-Z0-9_\-]{32,}['"]/.test(bodyText) ||
              /'"]sk-[a-zA-Z0-9]{20,}['"]/.test(bodyText),
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
          } catch (error: any) {
            complexity = 1;
          }

          const moduleName = path.basename(path.dirname(absolutePath));

          const hasCalls = calls.length > 0;
          const isSelf = !hasCalls;

          const funcEntity: any = {
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
            _isSelf: isSelf,
          };
          entities.functions.push(funcEntity);

          const constIndex = entities.constants.findIndex((c: any) => c.name === name);
          if (constIndex !== -1) {
            entities.constants.splice(constIndex, 1);
          }
        }
      }
    }

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

    // ✅ НОВОЕ: добавляем статистику по новым анализаторам
    const diCount = (entities as any).dynamicImports?.length || 0;
    const cfgCount = (entities as any).configRefs?.length || 0;
    const extCount = (entities as any).externalLibs?.length || 0;
    const vtCount = (entities as any).vueTemplates?.length || 0;
    const asyncCount = (entities as any).asyncChains?.length || 0;
    const closureCount = (entities as any).closures?.length || 0;
    const typeCount = (entities as any).typeDeps?.length || 0;

    if (diCount + cfgCount + extCount + vtCount + asyncCount + closureCount + typeCount > 0) {
      console.log(`   📊 Расширенный анализ:`);
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
  } catch (error: any) {
    return undefined;
  }
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ - ТОЛЬКО ИСПОЛЬЗУЕМЫЕ ФУНКЦИИ
// ============================================================

export default {
  extractEntitiesFromFile,
  // Кэширование
  AnalysisCache,
  analysisCache,
  // Миграция
  DataMigrator,
  migrator,
  // Новые анализаторы
  extractDynamicImports,
  extractConfigRefs,
  extractExternalLibs,
  extractVueTemplates,
  extractAsyncChains,
  extractClosures,
  extractTypeDeps,
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
