// src/reporters/compact-entity-reporter.ts

import fs from 'fs';
import path from 'path';
import { COMPACT_REPORT_CONFIG, type PresetConfig } from '../config.js';
import type { EntitiesResult } from '../types.js';
import idManager from '../core/IdManager.js';

// ============================================
// ТИПЫ ДЛЯ РЕБЕР ГРАФОВ
// ============================================

interface CallGraphEdge {
  from: string;
  to: string;
  line: number;
  type: 'direct' | 'import' | 'method' | 'computed' | 'watch' | 'event';
}

interface ImportGraphEdge {
  from: string;
  to: string;
  specifiers: string[];
  line: number;
  type: 'named' | 'default' | 'namespace' | 'type';
}

export interface CompactReportOptions {
  /** Использовать пресет из конфига */
  usePreset?: boolean;
  /** Переопределить поля сущностей */
  entityFields?: Record<string, boolean>;
  /** Переопределить поля связей */
  relationshipFields?: {
    calls?: Record<string, boolean>;
    calledBy?: Record<string, boolean>;
    importedBy?: Record<string, boolean>;
  };
  /** Переопределить фильтры */
  filters?: {
    entityTypes?: Record<string, boolean>;
    onlyExported?: boolean;
    onlyNonExported?: boolean;
    includeModules?: string[];
    excludeModules?: string[];
    minComplexity?: number;
    maxDepth?: number;
  };
  /** Переопределить форматирование */
  formatting?: {
    indentSize?: number;
    sortKeys?: boolean;
    sortEntities?: boolean;
    includeTimestamp?: boolean;
    includeStats?: boolean;
  };
  /** Максимальная глубина рекурсивного обхода вызовов */
  maxDepth?: number;
}

export interface CompactEntityReport {
  version: string;
  timestamp?: string;

  // === ГЛОБАЛЬНЫЕ ИНДЕКСЫ ===
  functionIndex: Record<string, string>; // id -> name
  fileIndex: Record<string, string>; // id -> path
  moduleIndex: Record<string, string>; // id -> module name

  // === СУЩНОСТИ С ССЫЛКАМИ ПО ID ===
  entities: Record<string, any>;

  // === ГРАФЫ С ССЫЛКАМИ ПО ID ===
  callGraph?: {
    edges: CallGraphEdge[];
    stats: {
      totalEdges: number;
      uniqueCallers: number;
      uniqueCallees: number;
      mostCalled: { functionId: string; count: number }[];
      topCallers: { functionId: string; count: number }[];
    };
  };

  importGraph?: {
    edges: ImportGraphEdge[];
    stats: {
      totalEdges: number;
      uniqueImporters: number;
      uniqueImported: number;
      mostImported: { fileId: string; count: number }[];
    };
  };

  stats: {
    totalFunctions: number;
    totalCalls: number;
    totalCalledBy: number;
    totalImportedBy: number;
    totalEnums: number;
    totalDecorators: number;
    totalFiles: number;
    totalModules: number;
  };

  legend?: {
    kinds?: Record<string, string>;
    callTypes?: Record<string, string>;
    importTypes?: Record<string, string>;
  };
}

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36).padStart(4, '0');
}

function generateFileId(filePath: string): string {
  const relativePath = path.relative(process.cwd(), filePath);
  return `file_${simpleHash(relativePath)}`;
}

function generateModuleId(moduleName: string): string {
  return `module_${simpleHash(moduleName)}`;
}

function shortenPath(filePath: string, maxLength: number = 60): string {
  const relative = path.relative(process.cwd(), filePath);
  if (relative.length <= maxLength) return relative;
  const parts = relative.split('/');
  if (parts.length <= 2) return relative;
  const first = parts[0] || '';
  const lastTwo = parts.slice(-2);
  return first + '/.../' + lastTwo.join('/');
}

// ============================================
// 1. ГЕНЕРАЦИЯ ИНДЕКСОВ
// ============================================

function generateIndices(entitiesMap: Record<string, EntitiesResult>): {
  functionIndex: Record<string, string>;
  fileIndex: Record<string, string>;
  moduleIndex: Record<string, string>;
  functionIdMap: Map<string, string>;
  fileIdMap: Map<string, string>;
} {
  const functionIndex: Record<string, string> = {};
  const functionIdMap = new Map<string, string>();
  const fileIndex: Record<string, string> = {};
  const fileIdMap = new Map<string, string>();
  const moduleIndex: Record<string, string> = {};

  // 1. Индексы файлов
  for (const [filePath] of Object.entries(entitiesMap)) {
    const fileId = generateFileId(filePath);
    const moduleName = path.basename(path.dirname(filePath));

    fileIndex[fileId] = shortenPath(filePath);
    fileIdMap.set(filePath, fileId);

    const moduleId = generateModuleId(moduleName);
    moduleIndex[moduleId] = moduleName;
  }

  // 2. Индексы функций
  for (const [filePath, entities] of Object.entries(entitiesMap)) {
    const moduleName = path.basename(filePath, path.extname(filePath));

    for (const func of entities.functions || []) {
      let id = `${moduleName}.${func.name}`;

      // Если есть конфликт, добавляем номер строки
      if (functionIndex[id]) {
        id = `${moduleName}.${func.name}_${func.line}`;
      }

      functionIndex[id] = func.name;
      functionIdMap.set(func.name, id);

      // Сохраняем ID в функции
      func.id = id;
    }
  }

  return {
    functionIndex,
    functionIdMap,
    fileIndex,
    fileIdMap,
    moduleIndex,
  };
}

// ============================================
// 2. ОПРЕДЕЛЕНИЕ ТИПА ВЫЗОВА
// ============================================

const VUE_COMPOSABLES = new Set([
  'computed',
  'ref',
  'reactive',
  'watch',
  'watchEffect',
  'provide',
  'inject',
  'useSlots',
  'useAttrs',
  'useModel',
  'onMounted',
  'onUpdated',
  'onUnmounted',
  'onBeforeMount',
  'onBeforeUpdate',
  'onBeforeUnmount',
  'onActivated',
  'onDeactivated',
  'toRef',
  'toRefs',
  'toValue',
  'isRef',
  'unref',
  'defineProps',
  'defineEmits',
  'defineExpose',
  'withDefaults',
  'defineModel',
  'defineOptions',
  'defineSlots',
  'defineComponent',
]);

function detectCallType(
  callName: string,
  funcBody: string
): 'direct' | 'import' | 'method' | 'computed' | 'watch' | 'event' {
  // Vue композаблы
  if (VUE_COMPOSABLES.has(callName)) {
    return 'computed';
  }

  // Vue события
  if (
    callName.startsWith('emit') ||
    callName.startsWith('on') ||
    callName.includes('Event') ||
    callName.startsWith('$emit')
  ) {
    return 'event';
  }

  // Вызов через объект: obj.method()
  if (funcBody && funcBody.includes(`.${callName}(`)) {
    return 'method';
  }

  // Импортированные функции (определяется по контексту)
  if (
    funcBody &&
    (funcBody.includes(`import { ${callName} }`) || funcBody.includes(`import ${callName}`))
  ) {
    return 'import';
  }

  return 'direct';
}

// ============================================
// 3. ПОСТРОЕНИЕ CALL GRAPH
// ============================================

function buildCallGraph(
  entitiesMap: Record<string, EntitiesResult>,
  functionIdMap: Map<string, string>
): CompactEntityReport['callGraph'] {
  const callGraphEdges: CallGraphEdge[] = [];
  const callCounts = new Map<string, number>();
  const callerCounts = new Map<string, number>();

  for (const [_filePath, entities] of Object.entries(entitiesMap)) {
    for (const func of entities.functions || []) {
      const callerId = func.id;
      if (!callerId) continue;

      const calls = func.calls || [];
      for (const callName of calls) {
        // Ищем вызываемую функцию
        const targetId = functionIdMap.get(callName);
        if (targetId && targetId !== callerId) {
          // Добавляем ребро
          callGraphEdges.push({
            from: callerId,
            to: targetId,
            line: func.line || 0,
            type: detectCallType(callName, func.body || ''),
          });

          // Считаем статистику
          callCounts.set(targetId, (callCounts.get(targetId) || 0) + 1);
          callerCounts.set(callerId, (callerCounts.get(callerId) || 0) + 1);
        }
      }
    }
  }

  // Сортируем для статистики
  const mostCalled = Array.from(callCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([functionId, count]) => ({ functionId, count }));

  const topCallers = Array.from(callerCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([functionId, count]) => ({ functionId, count }));

  // Уникальные ID
  const uniqueCallers = new Set(callGraphEdges.map((e: CallGraphEdge) => e.from));
  const uniqueCallees = new Set(callGraphEdges.map((e: CallGraphEdge) => e.to));

  return {
    edges: callGraphEdges,
    stats: {
      totalEdges: callGraphEdges.length,
      uniqueCallers: uniqueCallers.size,
      uniqueCallees: uniqueCallees.size,
      mostCalled,
      topCallers,
    },
  };
}

// ============================================
// 4. ПОСТРОЕНИЕ calledBy ИЗ CALL GRAPH
// ============================================

function buildCalledByFromCallGraph(
  callGraph: CompactEntityReport['callGraph']
): Record<string, string[]> {
  const calledByMap: Record<string, string[]> = {};

  if (!callGraph) return calledByMap;

  for (const edge of callGraph.edges) {
    const targetId = edge.to;
    if (!calledByMap[targetId]) {
      calledByMap[targetId] = [];
    }
    // Добавляем только уникальные callerId
    if (!calledByMap[targetId]?.includes(edge.from)) {
      calledByMap[targetId].push(edge.from);
    }
  }

  return calledByMap;
}

// ============================================
// 5. РЕЗОЛВИНГ ПУТЕЙ ИМПОРТОВ
// ============================================

function resolveImportPath(
  fromFile: string,
  importPath: string,
  entitiesMap: Record<string, EntitiesResult>
): string | null {
  const fromDir = path.dirname(fromFile);

  // Относительные пути
  if (importPath.startsWith('.')) {
    const resolved = path.resolve(fromDir, importPath);
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.vue', '.mjs', '.cjs'];

    for (const ext of extensions) {
      const candidate = resolved + ext;
      if (entitiesMap[candidate]) {
        return candidate;
      }
    }

    for (const ext of extensions) {
      const candidate = path.join(resolved, `index${ext}`);
      if (entitiesMap[candidate]) {
        return candidate;
      }
    }
    return null;
  }

  // Алиасы (@/, #/, ~/)
  if (importPath.startsWith('@/') || importPath.startsWith('#/') || importPath.startsWith('~/')) {
    const baseName = importPath.replace(/^[@#~]\//, '');
    for (const modulePath of Object.keys(entitiesMap)) {
      if (
        modulePath.endsWith(baseName) ||
        modulePath.endsWith(baseName + '.ts') ||
        modulePath.endsWith(baseName + '.js')
      ) {
        return modulePath;
      }
    }
    return null;
  }

  return null;
}

// ============================================
// 6. ПОСТРОЕНИЕ IMPORT GRAPH
// ============================================

function buildImportGraph(
  entitiesMap: Record<string, EntitiesResult>,
  fileIdMap: Map<string, string>
): CompactEntityReport['importGraph'] {
  const importGraphEdges: ImportGraphEdge[] = [];
  const importCounts = new Map<string, number>();

  for (const [filePath, entities] of Object.entries(entitiesMap)) {
    const fromFileId = fileIdMap.get(filePath);
    if (!fromFileId) continue;

    const imports = entities.imports || [];
    for (const imp of imports) {
      const source = imp.source;
      if (!source) continue;

      const resolvedPath = resolveImportPath(filePath, source, entitiesMap);
      if (!resolvedPath) continue;

      const toFileId = fileIdMap.get(resolvedPath);
      if (!toFileId) continue;

      const specifiers: string[] = [];
      let importType: 'named' | 'default' | 'namespace' | 'type' = 'named';

      for (const spec of imp.specifiers) {
        if (typeof spec === 'string') {
          specifiers.push(spec);
        } else {
          specifiers.push(spec.imported || spec.local);
          if (spec.type === 'ImportDefaultSpecifier') importType = 'default';
          else if (spec.type === 'ImportNamespaceSpecifier') importType = 'namespace';
        }
      }

      if (imp.isTypeOnly) importType = 'type';

      importGraphEdges.push({
        from: fromFileId,
        to: toFileId,
        specifiers,
        line: imp.loc?.start?.line || 0,
        type: importType,
      });

      importCounts.set(toFileId, (importCounts.get(toFileId) || 0) + 1);
    }
  }

  const mostImported = Array.from(importCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([fileId, count]) => ({ fileId, count }));

  const uniqueImporters = new Set(importGraphEdges.map((e: ImportGraphEdge) => e.from));
  const uniqueImported = new Set(importGraphEdges.map((e: ImportGraphEdge) => e.to));

  return {
    edges: importGraphEdges,
    stats: {
      totalEdges: importGraphEdges.length,
      uniqueImporters: uniqueImporters.size,
      uniqueImported: uniqueImported.size,
      mostImported,
    },
  };
}

// ============================================
// 7. ПОСТРОЕНИЕ ОПТИМИЗИРОВАННЫХ СУЩНОСТЕЙ
// ============================================

function buildOptimizedEntities(
  entitiesMap: Record<string, EntitiesResult>,
  functionIdMap: Map<string, string>,
  fileIdMap: Map<string, string>
): Record<string, any> {
  const entities: Record<string, any> = {};

  for (const [filePath, fileEntities] of Object.entries(entitiesMap)) {
    const fileId = fileIdMap.get(filePath);
    if (!fileId) continue;

    for (const func of fileEntities.functions || []) {
      const id = func.id || functionIdMap.get(func.name);
      if (!id) continue;

      const entity: any = {
        id: id,
        file: fileId,
        line: func.line || 0,
        kind: 'function',
      };

      if (func.name) entity.name = func.name;
      if (func.isExported) entity.isExported = true;
      if (func.isAsync) entity.isAsync = true;
      if (func.isArrow) entity.isArrow = true;
      if (func.isMethod) entity.isMethod = true;
      if (func.isNested) entity.isNested = true;
      if (func.isEventHandler) entity.isEventHandler = true;

      if (func.params && func.params.length > 0) entity.params = func.params;
      if (func.returnType && func.returnType !== 'any') entity.returnType = func.returnType;
      if (func.className) entity.className = func.className;
      if (func.eventType) entity.eventType = func.eventType;

      if (func.parentFunction) {
        const parentId = functionIdMap.get(func.parentFunction);
        if (parentId) entity.parentFunction = parentId;
      }

      if (func.depth && func.depth > 0) entity.depth = func.depth;
      if (func.complexity && func.complexity > 1) entity.complexity = func.complexity;

      if (func.calls && func.calls.length > 0) {
        const callIds = func.calls
          .map(callName => functionIdMap.get(callName))
          .filter((id): id is string => id !== undefined && id !== entity.id);
        if (callIds.length > 0) entity.calls = callIds;
      }

      entities[id] = entity;
    }
  }

  return entities;
}

// ============================================
// 8. ИЗВЛЕЧЕНИЕ ENUM И ДЕКОРАТОРОВ
// ============================================

function extractEnumsFromContent(
  content: string
): { name: string; values: string[]; line: number; isExported: boolean }[] {
  const enums: { name: string; values: string[]; line: number; isExported: boolean }[] = [];

  const enumRegex = /(?:export\\s+)?enum\\s+(\\w+)\\s*\\{([^}]*)\\}/g;
  let match: RegExpExecArray | null;
  while ((match = enumRegex.exec(content)) !== null) {
    const name = match[1] || 'unnamed';
    const valuesStr = match[2] || '';
    const isExported = content.includes(`export enum ${name}`);
    const line = content.substring(0, match.index).split('\\n').length;

    const values = valuesStr
      .split(',')
      .map(v => v.trim())
      .filter(v => v)
      .map(v => {
        const assignMatch = v.match(/^(\\w+)\\s*=\\s*(.+)$/);
        if (assignMatch) {
          const key = assignMatch[1] || '';
          const val = assignMatch[2]?.trim() || '';
          return `${key} = ${val}`;
        }
        return v;
      });

    enums.push({ name, values, line, isExported });
  }

  const constEnumRegex = /(?:export\\s+)?const\\s+enum\\s+(\\w+)\\s*\\{([^}]*)\\}/g;
  while ((match = constEnumRegex.exec(content)) !== null) {
    const name = match[1] || 'unnamed';
    const valuesStr = match[2] || '';
    const isExported = content.includes(`export const enum ${name}`);
    const line = content.substring(0, match.index).split('\\n').length;

    const values = valuesStr
      .split(',')
      .map(v => v.trim())
      .filter(v => v)
      .map(v => {
        const assignMatch = v.match(/^(\\w+)\\s*=\\s*(.+)$/);
        if (assignMatch) {
          const key = assignMatch[1] || '';
          const val = assignMatch[2]?.trim() || '';
          return `${key} = ${val}`;
        }
        return v;
      });

    enums.push({ name, values, line, isExported });
  }

  return enums;
}

function extractDecoratorsFromContent(
  content: string
): { name: string; target: string; line: number; args: string[] }[] {
  const decorators: { name: string; target: string; line: number; args: string[] }[] = [];

  const decoratorRegex =
    /@(\\w+)(?:\\\\(([^)]*)\\\\))?\\s*(?:class|function|method|property|accessor)\\s+(\\w+)/g;
  let match: RegExpExecArray | null;
  while ((match = decoratorRegex.exec(content)) !== null) {
    const name = match[1] || 'unknown';
    const args = match[2]
      ? match[2]
          .split(',')
          .map(a => a.trim())
          .filter(a => a)
      : [];
    const target = match[3] || 'unknown';
    const line = content.substring(0, match.index).split('\\n').length;

    decorators.push({ name, target, line, args });
  }

  const decoratorMultiLineRegex =
    /@(\\w+)(?:\\\\(([^)]*)\\\\))?\\s*\\n\\s*(?:class|function|method|property|accessor)\\s+(\\w+)/g;
  while ((match = decoratorMultiLineRegex.exec(content)) !== null) {
    const name = match[1] || 'unknown';
    const args = match[2]
      ? match[2]
          .split(',')
          .map(a => a.trim())
          .filter(a => a)
      : [];
    const target = match[3] || 'unknown';
    const line = content.substring(0, match.index).split('\\n').length;

    const exists = decorators.some(d => d.name === name && d.target === target && d.line === line);
    if (!exists) {
      decorators.push({ name, target, line, args });
    }
  }

  return decorators;
}

// ============================================
// 9. ОСНОВНАЯ ФУНКЦИЯ
// ============================================

export function generateCompactEntityReport(
  entitiesMap: Record<string, EntitiesResult>,
  outputPath: string,
  options: CompactReportOptions = {}
): CompactEntityReport {
  console.log('\\n🔧 Генерация компактного отчета с индексацией и графами...');
  console.log('='.repeat(60));

  const startTime = Date.now();

  // Очищаем кэш IdManager перед генерацией
  idManager.clear();

  // === 1. ЗАГРУЗКА КОНФИГУРАЦИИ ===
  let config: PresetConfig;
  if (options.usePreset !== false) {
    config = COMPACT_REPORT_CONFIG.getConfig();
    console.log(`📋 Использую пресет: ${COMPACT_REPORT_CONFIG.activePreset}`);
  } else {
    const relationshipFields: any = {};
    if (options.relationshipFields?.calls) {
      relationshipFields.calls = {
        enabled: true,
        targetId: true,
        targetName: true,
        targetFile: true,
        targetLine: true,
        targetVscode: true,
        callLine: true,
        callType: true,
        ...options.relationshipFields.calls,
      };
    }
    if (options.relationshipFields?.calledBy) {
      relationshipFields.calledBy = {
        enabled: true,
        callerId: true,
        callerName: true,
        callerFile: true,
        callerLine: true,
        callerVscode: true,
        callLine: true,
        callType: true,
        ...options.relationshipFields.calledBy,
      };
    }
    if (options.relationshipFields?.importedBy) {
      relationshipFields.importedBy = {
        enabled: true,
        importerId: true,
        importerFile: true,
        importerVscode: true,
        importLine: true,
        specifier: true,
        importType: true,
        ...options.relationshipFields.importedBy,
      };
    }

    const filters: any = {};
    if (options.filters) {
      if (options.filters.entityTypes) {
        filters.entityTypes = {
          function: true,
          class: true,
          constant: true,
          interface: true,
          type: true,
          variable: true,
          macro: true,
          ...options.filters.entityTypes,
        };
      }
      if (options.filters.onlyExported !== undefined) {
        filters.onlyExported = options.filters.onlyExported;
      }
      if (options.filters.onlyNonExported !== undefined) {
        filters.onlyNonExported = options.filters.onlyNonExported;
      }
      if (options.filters.includeModules) {
        filters.includeModules = options.filters.includeModules;
      }
      if (options.filters.excludeModules) {
        filters.excludeModules = options.filters.excludeModules;
      }
      if (options.filters.minComplexity !== undefined) {
        filters.minComplexity = options.filters.minComplexity;
      }
      if (options.filters.maxDepth !== undefined) {
        filters.maxDepth = options.filters.maxDepth;
      }
    }

    config = {
      entityFields: options.entityFields || {},
      relationshipFields: relationshipFields,
      filters: filters,
      formatting: options.formatting || {},
    };
  }

  const formatting = { ...(config.formatting || {}), ...(options.formatting || {}) } as {
    indentSize?: number;
    sortKeys?: boolean;
    sortEntities?: boolean;
    includeTimestamp?: boolean;
    includeStats?: boolean;
  };

  // === 2. ГЕНЕРАЦИЯ ИНДЕКСОВ ===
  console.log('\\n📊 Генерация индексов...');
  const { functionIndex, functionIdMap, fileIndex, fileIdMap, moduleIndex } =
    generateIndices(entitiesMap);

  console.log(`   📋 Индексов функций: ${Object.keys(functionIndex).length}`);
  console.log(`   📋 Индексов файлов: ${Object.keys(fileIndex).length}`);
  console.log(`   📋 Индексов модулей: ${Object.keys(moduleIndex).length}`);

  // === 3. ПОСТРОЕНИЕ ОПТИМИЗИРОВАННЫХ СУЩНОСТЕЙ ===
  console.log('\\n📦 Построение оптимизированных сущностей...');
  const entities = buildOptimizedEntities(entitiesMap, functionIdMap, fileIdMap);
  console.log(`   📊 Сущностей: ${Object.keys(entities).length}`);

  // === 4. ПОСТРОЕНИЕ CALL GRAPH ===
  console.log('\\n🔄 Построение графа вызовов (Call Graph)...');
  const callGraph = buildCallGraph(entitiesMap, functionIdMap);
  console.log(`   📊 Вызовов: ${callGraph?.edges.length || 0}`);
  console.log(`   📊 Уникальных вызывающих: ${callGraph?.stats.uniqueCallers || 0}`);
  console.log(`   📊 Уникальных вызываемых: ${callGraph?.stats.uniqueCallees || 0}`);

  if (callGraph && callGraph.stats.mostCalled && callGraph.stats.mostCalled.length > 0) {
    const mostCalled = callGraph.stats.mostCalled.slice(0, 3);
    const names = mostCalled.map(m => functionIndex[m.functionId] || 'unknown');
    console.log(`   📊 Самые вызываемые: ${names.join(', ')}`);
  }

  // === 5. ПОСТРОЕНИЕ calledBy ИЗ CALL GRAPH ===
  console.log('\\n📞 Построение обратных вызовов (calledBy)...');
  const calledByMap = buildCalledByFromCallGraph(callGraph);
  console.log(`   📊 Функций с обратными вызовами: ${Object.keys(calledByMap).length}`);

  // Добавляем calledBy в сущности
  for (const [id, calledBy] of Object.entries(calledByMap)) {
    if (entities[id]) {
      entities[id].calledBy = calledBy;
    }
  }

  // === 6. ПОСТРОЕНИЕ IMPORT GRAPH ===
  console.log('\\n📥 Построение графа импортов (Import Graph)...');
  const importGraph = buildImportGraph(entitiesMap, fileIdMap);
  console.log(`   📊 Импортов: ${importGraph?.edges.length || 0}`);
  console.log(`   📊 Уникальных импортеров: ${importGraph?.stats.uniqueImporters || 0}`);
  console.log(`   📊 Уникальных импортируемых: ${importGraph?.stats.uniqueImported || 0}`);

  if (importGraph && importGraph.stats.mostImported && importGraph.stats.mostImported.length > 0) {
    const mostImported = importGraph.stats.mostImported.slice(0, 3);
    const names = mostImported.map(m => fileIndex[m.fileId] || m.fileId);
    console.log(`   📊 Самые импортируемые: ${names.join(', ')}`);
  }

  // === 7. ИЗВЛЕЧЕНИЕ ENUM И ДЕКОРАТОРОВ ===
  console.log('\\n📚 Извлечение enum и декораторов...');
  let totalEnums = 0;
  let totalDecorators = 0;

  const fileContents: Record<string, string> = {};
  for (const filePath of Object.keys(entitiesMap)) {
    try {
      if (fs.existsSync(filePath)) {
        fileContents[filePath] = fs.readFileSync(filePath, 'utf-8');
      }
    } catch {
      // Игнорируем ошибки
    }
  }

  for (const [filePath, content] of Object.entries(fileContents)) {
    if (!content) continue;

    const fileId = fileIdMap.get(filePath);
    if (!fileId) continue;

    const enums = extractEnumsFromContent(content);
    for (const enumItem of enums) {
      const id = `enum_${simpleHash(filePath)}_${enumItem.name}`;
      entities[id] = {
        id,
        name: enumItem.name,
        file: fileId,
        line: enumItem.line,
        kind: 'enum',
        values: enumItem.values,
        isExported: enumItem.isExported,
        memberCount: enumItem.values.length,
      };
      totalEnums++;
    }

    const decorators = extractDecoratorsFromContent(content);
    for (const decorator of decorators) {
      const id = `decorator_${simpleHash(filePath)}_${decorator.name}_${decorator.target}`;
      entities[id] = {
        id,
        name: decorator.name,
        file: fileId,
        line: decorator.line,
        kind: 'decorator',
        target: decorator.target,
        args: decorator.args,
      };
      totalDecorators++;
    }
  }

  console.log(`   📊 Enum: ${totalEnums}, Декораторов: ${totalDecorators}`);

  // === 8. ПОДСЧЕТ СТАТИСТИКИ ===
  let totalCalls = 0;
  let totalCalledBy = 0;
  let totalImportedBy = 0;
  let totalFunctions = 0;

  for (const entity of Object.values(entities)) {
    if (entity.kind === 'function') {
      totalFunctions++;
      if (entity.calls) totalCalls += entity.calls.length;
      if (entity.calledBy) totalCalledBy += entity.calledBy.length;
    }
  }

  if (importGraph) {
    totalImportedBy = importGraph.edges.length;
  }

  const totalFiles = Object.keys(fileIndex).length;
  const totalModules = Object.keys(moduleIndex).length;

  // === 9. ФОРМИРОВАНИЕ ОТЧЕТА ===
  console.log('\\n📄 Формирование отчета...');

  const report: CompactEntityReport = {
    version: '3.0.1',
    timestamp: new Date().toISOString(),

    functionIndex,
    fileIndex,
    moduleIndex,

    entities,

    callGraph,
    importGraph,

    stats: {
      totalFunctions,
      totalCalls,
      totalCalledBy,
      totalImportedBy,
      totalEnums,
      totalDecorators,
      totalFiles,
      totalModules,
    },

    legend: {
      kinds: {
        function: 'Function declaration',
        class: 'Class declaration',
        enum: 'Enum declaration',
        decorator: 'Decorator',
        constant: 'Constant',
        interface: 'Interface',
        type: 'Type alias',
        variable: 'Variable',
      },
      callTypes: {
        direct: 'Direct function call',
        import: 'Imported function call',
        method: 'Method call',
        computed: 'Vue computed/watcher',
        watch: 'Vue watch',
        event: 'Event handler',
      },
      importTypes: {
        named: 'Named import',
        default: 'Default import',
        namespace: 'Namespace import',
        type: 'Type-only import',
      },
    },
  };

  // === 10. СОРТИРОВКА (опционально) ===
  if (formatting.sortEntities !== false) {
    const sortedEntities = Object.fromEntries(
      Object.entries(entities).sort((a, b) => {
        const kindOrder = {
          function: 0,
          enum: 1,
          decorator: 2,
          class: 3,
          constant: 4,
          interface: 5,
          type: 6,
          variable: 7,
        };
        const aOrder = kindOrder[a[1].kind as keyof typeof kindOrder] ?? 99;
        const bOrder = kindOrder[b[1].kind as keyof typeof kindOrder] ?? 99;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return (a[1].name || '').localeCompare(b[1].name || '');
      })
    );
    report.entities = sortedEntities;
  }

  // === 11. СОХРАНЕНИЕ ===
  const indent = formatting.indentSize || 2;
  const json = JSON.stringify(report, null, indent);

  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(outputPath, json, 'utf-8');

  // === 12. ИТОГОВАЯ СТАТИСТИКА ===
  const sizeKB = (json.length / 1024).toFixed(2);
  console.log(`\\n✅ Отчет сохранен: ${outputPath}`);
  console.log(`📊 Размер: ${sizeKB} KB`);
  console.log(`📊 Функций: ${totalFunctions}`);
  console.log(`📊 Вызовов: ${totalCalls}`);
  console.log(`📊 Обратных вызовов: ${totalCalledBy}`);
  console.log(`📊 Импортов: ${totalImportedBy}`);
  console.log(`📊 Файлов: ${totalFiles}`);
  console.log(`📊 Модулей: ${totalModules}`);
  console.log(`📊 Enum: ${totalEnums}`);
  console.log(`📊 Декораторов: ${totalDecorators}`);
  console.log(`⏱️  Время: ${((Date.now() - startTime) / 1000).toFixed(2)} сек`);

  const entitiesWithCalls = Object.values(entities).filter(
    e => e.kind === 'function' && e.calls && e.calls.length > 0
  );
  const entitiesWithCalledBy = Object.values(entities).filter(
    e => e.kind === 'function' && e.calledBy && e.calledBy.length > 0
  );

  console.log(`\\n📊 СТАТИСТИКА СВЯЗЕЙ:`);
  console.log(`   🔗 Сущностей с вызовами: ${entitiesWithCalls.length}`);
  console.log(`   🔗 Сущностей с обратными вызовами: ${entitiesWithCalledBy.length}`);

  if (entitiesWithCalls.length > 0) {
    const sample = entitiesWithCalls[0];
    console.log(`   📋 Пример: ${sample.name} → ${sample.calls.length} вызовов`);
  }

  if (entitiesWithCalls.length === 0) {
    console.log(`\\n⚠️ Внимание: вызовы между функциями не найдены`);
    console.log(`   Проверьте, что в проекте есть вызовы функций и они правильно резолвятся`);
  }

  const idStats = idManager.getStats();
  console.log(`\\n🔑 СТАТИСТИКА ID:`);
  console.log(`   📝 Всего сгенерировано ID: ${idStats.total}`);
  console.log(`   ✅ Уникальных ID: ${idStats.unique}`);
  console.log(`   📊 Всего сущностей в отчете: ${Object.keys(report.entities).length}`);

  return report;
}

export default generateCompactEntityReport;
