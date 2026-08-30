// src/reporters/compact-entity-reporter.ts

import fs from 'fs';
import path from 'path';
import { COMPACT_REPORT_CONFIG, type PresetConfig } from '../config.js';
import type { EntitiesResult } from '../types.js';
import idManager from '../core/IdManager.js';
import { loadTsConfig, resolveAliasPath } from '../core/tsconfig-resolver.js';

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

// ============================================
// НОВЫЕ ТИПЫ ДЛЯ ШАБЛОНОВ
// ============================================

export interface EntityTemplate {
  kind: string;
  isNested?: boolean;
  depth?: number;
  isAsync?: boolean;
  isMethod?: boolean;
  isExported?: boolean;
  isArrow?: boolean;
  isEventHandler?: boolean;
  eventType?: string;
  className?: string;
  parentFunction?: string;
  complexity?: number;
  security?: {
    hasEval: boolean;
    hasProcessEnv: boolean;
    hasSensitiveData: boolean;
    hasExec: boolean;
    hasPassword: boolean;
  };
}

interface TemplateRegistry {
  [templateId: string]: EntityTemplate;
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
    includeTests?: boolean;
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
  /** Корень проекта для резолвинга путей */
  projectRoot?: string;
  /** Формат ID: 'compact' (f142_704) или 'full' (func_4d647293_anonymous_getcycles_704) */
  idFormat?: 'compact' | 'full';
  /** Использовать шаблоны для оптимизации размера */
  useTemplates?: boolean;
}

export interface CompactEntityReport {
  version: string;
  timestamp?: string;

  // === НОВАЯ СЕКЦИЯ: ШАБЛОНЫ ===
  templates?: Record<string, EntityTemplate>;

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
      totalImports: number;
      resolvedImports: number;
      unresolvedImports: number;
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

  // === НОВАЯ СТАТИСТИКА ПО ШАБЛОНАМ ===
  templateStats?: {
    totalTemplates: number;
    totalEntities: number;
    usage: Record<string, number>;
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
// ФУНКЦИИ ДЛЯ РАБОТЫ С ШАБЛОНАМИ
// ============================================

/**
 * Определяет ключ шаблона по характеристикам сущности
 */
function getEntityTemplateKey(entity: any): string {
  const kind = entity.kind || 'function';
  const isNested = entity.isNested || false;
  const depth = entity.depth || 0;
  const isAsync = entity.isAsync || false;
  const isMethod = entity.isMethod || false;
  const isExported = entity.isExported || false;
  const isArrow = entity.isArrow || false;
  const isEventHandler = entity.isEventHandler || false;
  const hasClassName = entity.className && entity.className.length > 0;

  // Формируем ключ на основе характеристик
  let key = kind;

  if (kind === 'function') {
    // Определяем тип функции
    if (isMethod && hasClassName) {
      key += '_method';
    } else if (isArrow) {
      key += '_arrow';
    }

    // Добавляем модификаторы
    if (isAsync) key += '_async';
    if (isNested) key += `_nested_${Math.min(depth, 3)}`;
    if (isEventHandler) key += '_event';
    if (isExported) key += '_exported';

    // Если функция имеет специфические параметры
    if (entity.params && entity.params.length > 3) {
      key += '_many_params';
    }
  } else if (kind === 'class') {
    if (isNested) key += '_nested';
    if (isExported) key += '_exported';
  } else if (kind === 'interface') {
    if (isNested) key += '_nested';
    if (isExported) key += '_exported';
  } else if (kind === 'constant') {
    if (isExported) key += '_exported';
  } else if (kind === 'type') {
    if (isExported) key += '_exported';
  }

  return key;
}

/**
 * Создает шаблоны из сущностей
 */
function buildTemplates(entities: Record<string, any>): TemplateRegistry {
  const templates: TemplateRegistry = {};
  const templateGroups: Record<string, any[]> = {};

  // Группируем сущности по шаблону
  for (const [id, entity] of Object.entries(entities)) {
    const key = getEntityTemplateKey(entity);
    if (!templateGroups[key]) {
      templateGroups[key] = [];
    }
    templateGroups[key].push({ id, entity });
  }

  // Создаем шаблоны для каждой группы с количеством > 1
  for (const [key, group] of Object.entries(templateGroups)) {
    if (group.length > 1) {
      // Берем первую сущность как образец
      const sample = group[0].entity;
      const template: EntityTemplate = {
        kind: sample.kind,
      };

      // Добавляем опциональные поля если они есть в образце
      if (sample.isNested !== undefined) template.isNested = sample.isNested;
      if (sample.depth !== undefined) template.depth = sample.depth;
      if (sample.isAsync !== undefined) template.isAsync = sample.isAsync;
      if (sample.isMethod !== undefined) template.isMethod = sample.isMethod;
      if (sample.isExported !== undefined) template.isExported = sample.isExported;
      if (sample.isArrow !== undefined) template.isArrow = sample.isArrow;
      if (sample.isEventHandler !== undefined) template.isEventHandler = sample.isEventHandler;
      if (sample.eventType !== undefined) template.eventType = sample.eventType;
      if (sample.className !== undefined) template.className = sample.className;
      if (sample.parentFunction !== undefined) template.parentFunction = sample.parentFunction;
      if (sample.complexity !== undefined) template.complexity = sample.complexity;
      if (sample.security !== undefined) template.security = sample.security;

      templates[key] = template;
    }
  }

  return templates;
}

/**
 * Разворачивает шаблоны в полные сущности
 */
export function expandTemplates(report: CompactEntityReport): Record<string, any> {
  if (!report.templates || !report.entities) {
    return report.entities || {};
  }

  const expanded: Record<string, any> = {};

  for (const [id, entity] of Object.entries(report.entities)) {
    if (entity.$t && report.templates[entity.$t]) {
      // Объединяем шаблон и сущность
      expanded[id] = {
        ...report.templates[entity.$t],
        ...entity,
      };
      // Удаляем ссылку на шаблон из результата
      delete expanded[id].$t;
    } else {
      expanded[id] = entity;
    }
  }

  return expanded;
}

// ============================================
// 1. ГЕНЕРАЦИЯ ИНДЕКСОВ
// ============================================

function generateIndices(
  entitiesMap: Record<string, EntitiesResult>,
  idFormat: 'compact' | 'full' = 'compact'
): {
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

  // 2. Индексы функций - с поддержкой компактного формата
  for (const [filePath, entities] of Object.entries(entitiesMap)) {
    for (const func of entities.functions || []) {
      let id: string;

      if (idFormat === 'compact') {
        // Компактный формат: f{index}_{line}
        id = idManager.generateCompactId({
          filePath: filePath,
          funcName: func.name,
          line: func.line || 0,
          parentFunction: func.parentFunction,
          depth: func.depth || 0,
          type: 'function',
        });
      } else {
        // Полный формат (для обратной совместимости)
        id = idManager.getFunctionId({
          filePath: filePath,
          funcName: func.name,
          line: func.line || 0,
          parentFunction: func.parentFunction,
          depth: func.depth || 0,
          type: 'function',
        });
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
  entitiesMap: Record<string, EntitiesResult>,
  projectRoot: string = process.cwd()
): string | null {
  const fromDir = path.dirname(fromFile);

  // 1. Относительные пути (./, ../)
  if (importPath.startsWith('.')) {
    const candidates = [
      importPath,
      `${importPath}.ts`,
      `${importPath}.tsx`,
      `${importPath}.js`,
      `${importPath}.jsx`,
      `${importPath}.mjs`,
      `${importPath}.cjs`,
      `${importPath}.vue`,
      path.join(importPath, 'index.ts'),
      path.join(importPath, 'index.js'),
      path.join(importPath, 'index.tsx'),
      path.join(importPath, 'index.jsx'),
      path.join(importPath, 'index.vue'),
    ];

    for (const candidate of candidates) {
      const resolved = path.resolve(fromDir, candidate);
      if (entitiesMap[resolved]) {
        return resolved;
      }
      // Проверка без расширения (для TypeScript)
      const withoutExt = resolved.replace(/\.[^.]+$/, '');
      if (entitiesMap[withoutExt]) {
        return withoutExt;
      }
      // Проверка с .js для .ts файлов (import { x } from './file' -> file.ts)
      if (!candidate.includes('.')) {
        const tsPath = resolved + '.ts';
        if (entitiesMap[tsPath]) {
          return tsPath;
        }
      }
    }

    // Если не нашли, проверяем по имени файла
    const baseName = path.basename(importPath).replace(/\.[^.]+$/, '');
    for (const [modPath] of Object.entries(entitiesMap)) {
      const modBase = path.basename(modPath).replace(/\.[^.]+$/, '');
      if (modBase === baseName && path.dirname(modPath) === fromDir) {
        return modPath;
      }
    }

    return null;
  }

  // 2. Алиасы через tsconfig (@/, #/, ~/)
  if (importPath.startsWith('@') || importPath.startsWith('#') || importPath.startsWith('~')) {
    try {
      const tsConfig = loadTsConfig(projectRoot);
      const aliasedPath = resolveAliasPath(importPath, projectRoot, tsConfig);
      if (aliasedPath && entitiesMap[aliasedPath]) {
        return aliasedPath;
      }
    } catch (error) {
      // Игнорируем ошибки tsconfig
    }

    // Fallback: пробуем найти в src/
    const aliasName = importPath.replace(/^[@#~]\//, '');
    const srcDir = path.resolve(projectRoot, 'src');
    const candidates = [
      path.resolve(srcDir, aliasName),
      path.resolve(srcDir, `${aliasName}.ts`),
      path.resolve(srcDir, `${aliasName}.tsx`),
      path.resolve(srcDir, `${aliasName}.js`),
      path.resolve(srcDir, `${aliasName}.jsx`),
      path.resolve(srcDir, `${aliasName}.vue`),
      path.resolve(srcDir, aliasName, 'index.ts'),
      path.resolve(srcDir, aliasName, 'index.js'),
      path.resolve(srcDir, aliasName, 'index.tsx'),
      path.resolve(srcDir, aliasName, 'index.jsx'),
      path.resolve(srcDir, aliasName, 'index.vue'),
    ];

    for (const candidate of candidates) {
      if (entitiesMap[candidate]) {
        return candidate;
      }
    }

    // Проверяем по имени файла
    const baseName = path.basename(aliasName);
    for (const [modPath] of Object.entries(entitiesMap)) {
      if (modPath.includes(baseName) || modPath.endsWith(`/${aliasName}`)) {
        return modPath;
      }
    }
  }

  // 3. Поиск по имени файла (для локальных модулей)
  const baseName = path.basename(importPath).replace(/\.[^.]+$/, '');
  for (const [modPath] of Object.entries(entitiesMap)) {
    const modBase = path.basename(modPath).replace(/\.[^.]+$/, '');
    if (modBase === baseName && !importPath.startsWith('.')) {
      return modPath;
    }
  }

  return null;
}

// ============================================
// 6. ПОСТРОЕНИЕ IMPORT GRAPH
// ============================================

function buildImportGraph(
  entitiesMap: Record<string, EntitiesResult>,
  fileIdMap: Map<string, string>,
  projectRoot: string = process.cwd()
): CompactEntityReport['importGraph'] {
  const importGraphEdges: ImportGraphEdge[] = [];
  const importCounts = new Map<string, number>();

  // Создаем индекс всех файлов для быстрого поиска
  const fileIndex = new Map<string, string>();
  const fileDirIndex = new Map<string, Set<string>>();

  for (const filePath of Object.keys(entitiesMap)) {
    const fileName = path.basename(filePath);
    const dirName = path.dirname(filePath);

    if (!fileIndex.has(fileName)) {
      fileIndex.set(fileName, filePath);
    }
    if (!fileDirIndex.has(dirName)) {
      fileDirIndex.set(dirName, new Set());
    }
    fileDirIndex.get(dirName)!.add(filePath);
  }

  let totalImports = 0;
  let resolvedImports = 0;

  for (const [filePath, entities] of Object.entries(entitiesMap)) {
    const fromFileId = fileIdMap.get(filePath);
    if (!fromFileId) continue;

    const imports = entities.imports || [];

    for (const imp of imports) {
      const source = imp.source;
      if (!source) continue;

      totalImports++;

      // Пропускаем внешние модули (node_modules)
      if (
        !source.startsWith('.') &&
        !source.startsWith('@') &&
        !source.startsWith('#') &&
        !source.startsWith('~')
      ) {
        continue;
      }

      const resolvedPath = resolveImportPath(filePath, source, entitiesMap, projectRoot);
      if (!resolvedPath) {
        continue;
      }

      resolvedImports++;

      const toFileId = fileIdMap.get(resolvedPath);
      if (!toFileId) continue;

      // Извлекаем спецификаторы
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

      // Избегаем дублирования ребер
      const existingEdge = importGraphEdges.find(e => e.from === fromFileId && e.to === toFileId);

      if (existingEdge) {
        // Объединяем спецификаторы
        const newSpecifiers = [...new Set([...existingEdge.specifiers, ...specifiers])];
        existingEdge.specifiers = newSpecifiers;
        if (importType === 'type' && existingEdge.type !== 'type') {
          existingEdge.type = 'type';
        }
      } else {
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
  }

  // Статистика
  const uniqueImporters = new Set(importGraphEdges.map(e => e.from));
  const uniqueImported = new Set(importGraphEdges.map(e => e.to));

  const mostImported = Array.from(importCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([fileId, count]) => ({ fileId, count }));

  return {
    edges: importGraphEdges,
    stats: {
      totalEdges: importGraphEdges.length,
      uniqueImporters: uniqueImporters.size,
      uniqueImported: uniqueImported.size,
      mostImported,
      totalImports,
      resolvedImports,
      unresolvedImports: totalImports - resolvedImports,
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
      if (func.isNested !== undefined) entity.isNested = func.isNested;
      if (func.depth !== undefined) entity.depth = func.depth;

      if (func.params && func.params.length > 0) entity.params = func.params;
      if (func.returnType && func.returnType !== 'any') entity.returnType = func.returnType;
      if (func.className) entity.className = func.className;
      if (func.eventType) entity.eventType = func.eventType;
      if (func.parentFunction) entity.parentFunction = func.parentFunction;

      if (func.complexity && func.complexity > 1) entity.complexity = func.complexity;
      if (func.security) entity.security = func.security;

      if (func.calls && func.calls.length > 0) {
        const callIds = func.calls
          .map(callName => functionIdMap.get(callName))
          .filter((callId): callId is string => callId !== undefined && callId !== id);
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

  const enumRegex = /(?:export\s+)?enum\s+(\w+)\s*\{([^}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = enumRegex.exec(content)) !== null) {
    const name = match[1] || 'unnamed';
    const valuesStr = match[2] || '';
    const isExported = content.includes(`export enum ${name}`);
    const line = content.substring(0, match.index).split('\n').length;

    const values = valuesStr
      .split(',')
      .map(v => v.trim())
      .filter(v => v)
      .map(v => {
        const assignMatch = v.match(/^(\w+)\s*=\s*(.+)$/);
        if (assignMatch) {
          const key = assignMatch[1] || '';
          const val = assignMatch[2]?.trim() || '';
          return `${key} = ${val}`;
        }
        return v;
      });

    enums.push({ name, values, line, isExported });
  }

  const constEnumRegex = /(?:export\s+)?const\s+enum\s+(\w+)\s*\{([^}]*)\}/g;
  while ((match = constEnumRegex.exec(content)) !== null) {
    const name = match[1] || 'unnamed';
    const valuesStr = match[2] || '';
    const isExported = content.includes(`export const enum ${name}`);
    const line = content.substring(0, match.index).split('\n').length;

    const values = valuesStr
      .split(',')
      .map(v => v.trim())
      .filter(v => v)
      .map(v => {
        const assignMatch = v.match(/^(\w+)\s*=\s*(.+)$/);
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
    /@(\w+)(?:\(([^)]*)\))?\s*(?:class|function|method|property|accessor)\s+(\w+)/g;
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
    const line = content.substring(0, match.index).split('\n').length;

    decorators.push({ name, target, line, args });
  }

  const decoratorMultiLineRegex =
    /@(\w+)(?:\(([^)]*)\))?\s*\n\s*(?:class|function|method|property|accessor)\s+(\w+)/g;
  while ((match = decoratorMultiLineRegex.exec(content)) !== null) {
    const name = match[1] || 'unknown';
    const args = match[2]
      ? match[2]
          .split(',')
          .map(a => a.trim())
          .filter(a => a)
      : [];
    const target = match[3] || 'unknown';
    const line = content.substring(0, match.index).split('\n').length;

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
  console.log('\n🔧 Генерация компактного отчета с индексацией и графами...');
  console.log('='.repeat(60));

  const startTime = Date.now();
  const projectRoot = options.projectRoot || process.cwd();
  const idFormat = options.idFormat || 'compact';
  const useTemplates = options.useTemplates !== false; // По умолчанию true

  console.log(`📋 Формат ID: ${idFormat === 'compact' ? 'КОМПАКТНЫЙ (f142_704)' : 'ПОЛНЫЙ'}`);
  console.log(`📋 Шаблоны: ${useTemplates ? 'ВКЛЮЧЕНЫ' : 'ВЫКЛЮЧЕНЫ'}`);

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
  console.log('\n📊 Генерация индексов...');
  const { functionIndex, functionIdMap, fileIndex, fileIdMap, moduleIndex } = generateIndices(
    entitiesMap,
    idFormat
  );

  console.log(`   📋 Индексов функций: ${Object.keys(functionIndex).length}`);
  console.log(`   📋 Индексов файлов: ${Object.keys(fileIndex).length}`);
  console.log(`   📋 Индексов модулей: ${Object.keys(moduleIndex).length}`);

  // === 3. ПОСТРОЕНИЕ ОПТИМИЗИРОВАННЫХ СУЩНОСТЕЙ ===
  console.log('\n📦 Построение оптимизированных сущностей...');
  const rawEntities = buildOptimizedEntities(entitiesMap, functionIdMap, fileIdMap);
  console.log(`   📊 Сущностей: ${Object.keys(rawEntities).length}`);

  // === 4. ПОСТРОЕНИЕ CALL GRAPH ===
  console.log('\n🔄 Построение графа вызовов (Call Graph)...');
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
  console.log('\n📞 Построение обратных вызовов (calledBy)...');
  const calledByMap = buildCalledByFromCallGraph(callGraph);
  console.log(`   📊 Функций с обратными вызовами: ${Object.keys(calledByMap).length}`);

  // Добавляем calledBy в сущности
  for (const [id, calledBy] of Object.entries(calledByMap)) {
    if (rawEntities[id]) {
      rawEntities[id].calledBy = calledBy;
    }
  }

  // === 6. ПОСТРОЕНИЕ IMPORT GRAPH ===
  console.log('\n📥 Построение графа импортов (Import Graph)...');
  const importGraph = buildImportGraph(entitiesMap, fileIdMap, projectRoot);
  console.log(`   📊 Импортов всего: ${importGraph?.stats.totalImports || 0}`);
  console.log(`   ✅ Разрешенных: ${importGraph?.stats.resolvedImports || 0}`);
  console.log(`   ❌ Неразрешенных: ${importGraph?.stats.unresolvedImports || 0}`);
  console.log(`   📊 Ребер в графе: ${importGraph?.edges.length || 0}`);
  console.log(`   📥 Уникальных импортеров: ${importGraph?.stats.uniqueImporters || 0}`);
  console.log(`   📤 Уникальных импортируемых: ${importGraph?.stats.uniqueImported || 0}`);

  if (importGraph && importGraph.stats.mostImported && importGraph.stats.mostImported.length > 0) {
    const mostImported = importGraph.stats.mostImported.slice(0, 3);
    const names = mostImported.map(m => fileIndex[m.fileId] || m.fileId);
    console.log(`   📊 Самые импортируемые: ${names.join(', ')}`);
  }

  // === 7. ИЗВЛЕЧЕНИЕ ENUM И ДЕКОРАТОРОВ ===
  console.log('\n📚 Извлечение enum и декораторов...');
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
      rawEntities[id] = {
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
      rawEntities[id] = {
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

  // === 8. СОЗДАНИЕ ШАБЛОНОВ ===
  let templates: TemplateRegistry = {};
  let optimizedEntities = rawEntities;
  let templateStats:
    { totalTemplates: number; totalEntities: number; usage: Record<string, number> } | undefined =
    undefined;

  if (useTemplates) {
    console.log('\n📋 Создание шаблонов для оптимизации...');

    // Строим шаблоны на основе rawEntities
    templates = buildTemplates(rawEntities);
    console.log(`   📊 Создано шаблонов: ${Object.keys(templates).length}`);

    // Применяем шаблоны к сущностям
    const templateUsage: Record<string, number> = {};
    optimizedEntities = {};

    for (const [id, entity] of Object.entries(rawEntities)) {
      const templateKey = getEntityTemplateKey(entity);

      // Считаем использование шаблонов
      templateUsage[templateKey] = (templateUsage[templateKey] || 0) + 1;

      // Создаем новую сущность с ссылкой на шаблон
      const optimizedEntity: any = {
        $t: templateKey,
      };

      // Копируем только уникальные поля (не из шаблона)
      const templateFields = new Set(Object.keys(templates[templateKey] || {}));

      for (const [field, value] of Object.entries(entity)) {
        if (!templateFields.has(field)) {
          optimizedEntity[field] = value;
        }
      }

      optimizedEntities[id] = optimizedEntity;
    }

    console.log(`   📊 Использование шаблонов:`);
    const sortedUsage = Object.entries(templateUsage).sort((a, b) => b[1] - a[1]);
    for (const [key, count] of sortedUsage.slice(0, 10)) {
      console.log(`      • ${key}: ${count} сущностей`);
    }
    if (sortedUsage.length > 10) {
      console.log(`      • ... и ещё ${sortedUsage.length - 10} шаблонов`);
    }

    // Сохраняем статистику по шаблонам
    templateStats = {
      totalTemplates: Object.keys(templates).length,
      totalEntities: Object.keys(optimizedEntities).length,
      usage: templateUsage,
    };
  } else {
    console.log('\n⏭️ Шаблоны отключены, используем полные сущности');
    optimizedEntities = rawEntities;
    templateStats = undefined;
  }

  // === 9. ПОДСЧЕТ СТАТИСТИКИ ===
  let totalCalls = 0;
  let totalCalledBy = 0;
  let totalImportedBy = 0;
  let totalFunctions = 0;

  // Используем rawEntities для подсчета (они содержат все поля)
  for (const entity of Object.values(rawEntities)) {
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

  // === 10. ФОРМИРОВАНИЕ ОТЧЕТА ===
  console.log('\n📄 Формирование отчета...');

  const report: CompactEntityReport = {
    version: '3.0.2',
    timestamp: new Date().toISOString(),

    // Добавляем секцию шаблонов
    templates: useTemplates ? templates : undefined,

    functionIndex,
    fileIndex,
    moduleIndex,

    // Используем оптимизированные сущности
    entities: optimizedEntities,

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

    // Добавляем статистику по шаблонам
    templateStats: templateStats,

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

  // === 11. СОРТИРОВКА (опционально) ===
  if (formatting.sortEntities !== false) {
    const sortedEntities = Object.fromEntries(
      Object.entries(optimizedEntities).sort((a, b) => {
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

  // === 12. СОХРАНЕНИЕ ===
  const indent = formatting.indentSize || 2;
  const json = JSON.stringify(report, null, indent);

  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(outputPath, json, 'utf-8');

  // === 13. ИТОГОВАЯ СТАТИСТИКА ===
  const sizeKB = (json.length / 1024).toFixed(2);

  // Вычисляем экономию
  const rawJson = JSON.stringify(rawEntities);
  const optimizedJson = JSON.stringify(optimizedEntities);
  const savings = ((1 - optimizedJson.length / rawJson.length) * 100).toFixed(1);
  const savingsKB = ((rawJson.length - optimizedJson.length) / 1024).toFixed(1);

  console.log(`\n✅ Отчет сохранен: ${outputPath}`);
  console.log(`📊 Размер: ${sizeKB} KB`);
  if (useTemplates) {
    console.log(`📊 ЭКОНОМИЯ: ${savings}% (${savingsKB} KB)`);
    console.log(`📋 Шаблонов: ${Object.keys(templates).length}`);
    console.log(`📋 Сущностей: ${Object.keys(optimizedEntities).length}`);
  }
  console.log(`📊 Функций: ${totalFunctions}`);
  console.log(`📊 Вызовов: ${totalCalls}`);
  console.log(`📊 Обратных вызовов: ${totalCalledBy}`);
  console.log(`📊 Импортов: ${totalImportedBy}`);
  console.log(`📊 Файлов: ${totalFiles}`);
  console.log(`📊 Модулей: ${totalModules}`);
  console.log(`📊 Enum: ${totalEnums}`);
  console.log(`📊 Декораторов: ${totalDecorators}`);
  console.log(`⏱️  Время: ${((Date.now() - startTime) / 1000).toFixed(2)} сек`);

  const entitiesWithCalls = Object.values(rawEntities).filter(
    e => e.kind === 'function' && e.calls && e.calls.length > 0
  );
  const entitiesWithCalledBy = Object.values(rawEntities).filter(
    e => e.kind === 'function' && e.calledBy && e.calledBy.length > 0
  );

  console.log(`\n📊 СТАТИСТИКА СВЯЗЕЙ:`);
  console.log(`   🔗 Сущностей с вызовами: ${entitiesWithCalls.length}`);
  console.log(`   🔗 Сущностей с обратными вызовами: ${entitiesWithCalledBy.length}`);

  if (entitiesWithCalls.length > 0) {
    const sample = entitiesWithCalls[0];
    console.log(`   📋 Пример: ${sample.name} → ${sample.calls.length} вызовов`);
  }

  if (entitiesWithCalls.length === 0) {
    console.log(`\n⚠️ Внимание: вызовы между функциями не найдены`);
    console.log(`   Проверьте, что в проекте есть вызовы функций и они правильно резолвятся`);
  }

  // Статистика импортов
  if (importGraph && importGraph.edges.length > 0) {
    console.log(`\n📥 СТАТИСТИКА ИМПОРТОВ:`);
    console.log(`   📊 Всего ребер: ${importGraph.edges.length}`);
    console.log(`   📥 Уникальных импортеров: ${importGraph.stats.uniqueImporters}`);
    console.log(`   📤 Уникальных импортируемых: ${importGraph.stats.uniqueImported}`);
    console.log(`   ✅ Разрешенных импортов: ${importGraph.stats.resolvedImports}`);
    console.log(`   ❌ Неразрешенных импортов: ${importGraph.stats.unresolvedImports}`);

    // Топ импортируемых файлов
    if (importGraph.stats.mostImported && importGraph.stats.mostImported.length > 0) {
      console.log(`\n📤 Самые импортируемые файлы:`);
      for (const item of importGraph.stats.mostImported.slice(0, 5)) {
        const fileName = fileIndex[item.fileId] || item.fileId;
        console.log(`   • ${fileName}: ${item.count} раз`);
      }
    }
  } else {
    console.log(`\n⚠️ Внимание: граф импортов пуст`);
    console.log(`   Возможные причины:`);
    console.log(`   1. Анализируется только один файл (нужна вся папка src/)`);
    console.log(`   2. Нет данных об импортах в entitiesMap`);
    console.log(`   3. Пути импортов не могут быть разрешены`);
  }

  const idStats = idManager.getStats();
  console.log(`\n🔑 СТАТИСТИКА ID:`);
  console.log(`   📝 Всего сгенерировано ID: ${idStats.total}`);
  console.log(`   ✅ Уникальных ID: ${idStats.unique}`);
  console.log(`   📊 Всего сущностей в отчете: ${Object.keys(report.entities).length}`);

  // Дополнительная статистика по формату ID
  if (idFormat === 'compact') {
    const ids = Object.keys(report.entities);
    const avgLength = ids.reduce((sum, id) => sum + id.length, 0) / (ids.length || 1);
    console.log(`   📏 Средняя длина компактного ID: ${avgLength.toFixed(1)} символов`);
    console.log(`   💾 Экономия vs полный формат: ~${((1 - avgLength / 39) * 100).toFixed(0)}%`);
  }

  // Статистика по шаблонам
  if (useTemplates && templates && templateStats) {
    console.log(`\n📋 СТАТИСТИКА ШАБЛОНОВ:`);
    const templateKeys = Object.keys(templates);
    console.log(`   📊 Всего шаблонов: ${templateKeys.length}`);
    console.log(`   📊 Типы шаблонов:`);

    const typeCount: Record<string, number> = {};
    for (const key of templateKeys) {
      const parts = key.split('_');
      const type = parts[0] || 'unknown';
      typeCount[type] = (typeCount[type] || 0) + 1;
    }

    for (const [type, count] of Object.entries(typeCount).sort((a, b) => b[1] - a[1])) {
      console.log(`      • ${type}: ${count} шаблонов`);
    }

    // Примеры шаблонов
    if (templateKeys.length > 0) {
      console.log(`\n   📋 Примеры шаблонов:`);
      const sampleKeys = templateKeys.slice(0, 3);
      for (const key of sampleKeys) {
        const template = templates[key];
        if (template) {
          const fields = Object.keys(template).filter(f => f !== 'kind');
          console.log(
            `      • ${key}: kind=${template.kind}${fields.length ? `, fields: ${fields.join(', ')}` : ''}`
          );
        }
      }
      if (templateKeys.length > 3) {
        console.log(`      ... и ещё ${templateKeys.length - 3} шаблонов`);
      }
    }
  }

  return report;
}

export default generateCompactEntityReport;
