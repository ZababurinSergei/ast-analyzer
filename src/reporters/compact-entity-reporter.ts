// src/reporters/compact-entity-reporter.ts

import fs from 'fs';
import path from 'path';
import { COMPACT_REPORT_CONFIG, type PresetConfig } from '../config.js';
import type { EntitiesResult } from '../types.js';
import idManager from '../core/IdManager.js';
import { loadTsConfig, resolveAliasPath } from '../core/tsconfig-resolver.js';

// ============================================
// ТИПЫ ДЛЯ НОВОЙ ULTRA-COMPACT СТРУКТУРЫ
// ============================================

export interface UltraCompactReport {
  version: string;
  timestamp?: string;

  // Индексы (единственный источник правды)
  functionIndex: Record<string, string>;  // id -> name
  fileIndex: Record<string, string>;      // id -> path
  moduleIndex: Record<string, string>;    // id -> module name

  // Словари для параметров и типов
  parameterDictionary: Record<string, string>;
  typeDictionary: Record<string, string>;

  // Граф вызовов (единственный источник)
  callGraph?: {
    edges: UltraCallGraphEdge[];
    stats: {
      totalEdges: number;
      uniqueCallers: number;
      uniqueCallees: number;
      mostCalled: { functionId: string; count: number }[];
      topCallers: { functionId: string; count: number }[];
    };
  };

  // Граф импортов
  importGraph?: {
    edges: UltraImportGraphEdge[];
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

  // Сущности (без дублей!)
  entities: Record<string, UltraCompactEntity>;

  // Шаблоны (для общих полей)
  templates?: Record<string, EntityTemplate>;

  // Статистика
  stats: UltraCompactStats;

  // Статистика по шаблонам
  templateStats?: {
    totalTemplates: number;
    totalEntities: number;
    usage: Record<string, number>;
  };

  // Легенда
  legend?: {
    kinds?: Record<string, string>;
    callTypes?: Record<string, string>;
    importTypes?: Record<string, string>;
  };
}

export interface UltraCompactEntity {
  file: string;           // ссылка на fileIndex
  line: number;
  flags: number;          // битовые флаги (см. FunctionFlags)
  params?: string[];      // ссылки на parameterDictionary
  returnType?: string;    // ссылка на typeDictionary
  template?: string;      // ссылка на templates
  // Дополнительные поля (редкие)
  className?: string;     // только если isMethod = true
  parentFunction?: string; // только если isNested = true
  eventType?: string;     // только если isEventHandler = true
  complexity?: number;    // только если > 1
  body?: string;          // только если включено в опциях
  vscode?: string;        // только если включено в опциях
  security?: any;         // только если включено в опциях
}

export interface UltraCallGraphEdge {
  from: string;
  to: string;
  line: number;
  type: 'direct' | 'import' | 'method' | 'computed' | 'watch' | 'event';
}

export interface UltraImportGraphEdge {
  from: string;
  to: string;
  specifiers: string[];
  line: number;
  type: 'named' | 'default' | 'namespace' | 'type';
}

export interface UltraCompactStats {
  totalFunctions: number;
  totalCalls: number;
  totalCalledBy: number;
  totalImportedBy: number;
  totalEnums: number;
  totalDecorators: number;
  totalFiles: number;
  totalModules: number;
}

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

// ============================================
// ТИПЫ ДЛЯ КОНФИГА
// ============================================

export interface EntityTypesFilter {
  function: boolean;
  class: boolean;
  constant: boolean;
  interface: boolean;
  type: boolean;
  variable: boolean;
  macro: boolean;
}

export interface FiltersConfig {
  entityTypes: EntityTypesFilter;
  onlyExported: boolean;
  onlyNonExported: boolean;
  includeModules: string[];
  excludeModules: string[];
  minComplexity: number;
  maxDepth: number;
}

export interface RelationshipFieldConfig {
  enabled: boolean;
  targetId: boolean;
  targetName: boolean;
  targetFile: boolean;
  targetLine: boolean;
  targetVscode: boolean;
  callLine: boolean;
  callType: boolean;
}

export interface CalledByFieldConfig {
  enabled: boolean;
  callerId: boolean;
  callerName: boolean;
  callerFile: boolean;
  callerLine: boolean;
  callerVscode: boolean;
  callLine: boolean;
  callType: boolean;
}

export interface ImportedByFieldConfig {
  enabled: boolean;
  importerId: boolean;
  importerFile: boolean;
  importerVscode: boolean;
  importLine: boolean;
  specifier: boolean;
  importType: boolean;
}

export interface RelationshipFieldsConfig {
  calls: RelationshipFieldConfig;
  calledBy: CalledByFieldConfig;
  importedBy: ImportedByFieldConfig;
}

export interface CompactReportOptions {
  usePreset?: boolean;
  entityFields?: Record<string, boolean>;
  relationshipFields?: Partial<RelationshipFieldsConfig>;
  filters?: Partial<FiltersConfig>;
  formatting?: {
    indentSize?: number;
    sortKeys?: boolean;
    sortEntities?: boolean;
    includeTimestamp?: boolean;
    includeStats?: boolean;
  };
  maxDepth?: number;
  projectRoot?: string;
  idFormat?: 'compact' | 'full';
  useTemplates?: boolean;
  // НОВЫЕ ОПЦИИ ДЛЯ ULTRA-COMPACT
  ultraCompact?: boolean;
  useBitFlags?: boolean;
  useDictionaries?: boolean;
  dedupData?: boolean;
  readableKeys?: boolean;
}

// ============================================
// БИТОВЫЕ ФЛАГИ
// ============================================

export enum FunctionFlags {
  ASYNC         = 1 << 0,  // 1
  NESTED        = 1 << 1,  // 2
  ARROW         = 1 << 2,  // 4
  METHOD        = 1 << 3,  // 8
  EVENT_HANDLER = 1 << 4,  // 16
  EXPORTED      = 1 << 5,  // 32
}

export function encodeFlags(entity: any): number {
  let flags = 0;
  if (entity.isAsync) flags |= FunctionFlags.ASYNC;
  if (entity.isNested) flags |= FunctionFlags.NESTED;
  if (entity.isArrow) flags |= FunctionFlags.ARROW;
  if (entity.isMethod) flags |= FunctionFlags.METHOD;
  if (entity.isEventHandler) flags |= FunctionFlags.EVENT_HANDLER;
  if (entity.isExported) flags |= FunctionFlags.EXPORTED;
  return flags;
}

export function decodeFlags(flags: number): Record<string, boolean> {
  return {
    isAsync: !!(flags & FunctionFlags.ASYNC),
    isNested: !!(flags & FunctionFlags.NESTED),
    isArrow: !!(flags & FunctionFlags.ARROW),
    isMethod: !!(flags & FunctionFlags.METHOD),
    isEventHandler: !!(flags & FunctionFlags.EVENT_HANDLER),
    isExported: !!(flags & FunctionFlags.EXPORTED),
  };
}

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
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

  let key = kind;

  if (kind === 'function') {
    if (isMethod && hasClassName) {
      key += '_method';
    } else if (isArrow) {
      key += '_arrow';
    }

    if (isAsync) key += '_async';
    if (isNested) key += `_nested_${Math.min(depth, 3)}`;
    if (isEventHandler) key += '_event';
    if (isExported) key += '_exported';

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

function buildTemplates(entities: Record<string, any>): Record<string, EntityTemplate> {
  const templates: Record<string, EntityTemplate> = {};
  const templateGroups: Record<string, any[]> = {};

  for (const [id, entity] of Object.entries(entities)) {
    const key = getEntityTemplateKey(entity);
    if (!templateGroups[key]) {
      templateGroups[key] = [];
    }
    templateGroups[key].push({ id, entity });
  }

  for (const [key, group] of Object.entries(templateGroups)) {
    if (group.length > 1) {
      const sample = group[0].entity;
      const template: EntityTemplate = {
        kind: sample.kind,
      };

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

// ============================================
// 🆕 ФУНКЦИЯ ДЛЯ УДАЛЕНИЯ ДУБЛИРУЮЩИХ ПОЛЕЙ
// ============================================

/**
 * Удаляет дублирующие поля из сущностей
 * calls, calledBy, callsInfo, calledByInfo вынесены в callGraph
 */
function removeDuplicateFields(entities: Record<string, any>): Record<string, any> {
  const optimized: Record<string, any> = {};

  for (const [id, entity] of Object.entries(entities)) {
    // Создаем копию без дублирующих полей
    const {
      calls,
      calledBy,
      callsInfo,
      calledByInfo,
      ...cleanEntity
    } = entity;

    optimized[id] = cleanEntity;
  }

  return optimized;
}

// ============================================
// ОПРЕДЕЛЕНИЕ ТИПА ВЫЗОВА
// ============================================

const VUE_COMPOSABLES = new Set([
  'computed', 'ref', 'reactive', 'watch', 'watchEffect',
  'provide', 'inject', 'useSlots', 'useAttrs', 'useModel',
  'onMounted', 'onUpdated', 'onUnmounted', 'onBeforeMount',
  'onBeforeUpdate', 'onBeforeUnmount', 'onActivated', 'onDeactivated',
  'toRef', 'toRefs', 'toValue', 'isRef', 'unref',
  'defineProps', 'defineEmits', 'defineExpose', 'withDefaults',
  'defineModel', 'defineOptions', 'defineSlots', 'defineComponent',
]);

function detectCallType(callName: string, funcBody: string): UltraCallGraphEdge['type'] {
  if (VUE_COMPOSABLES.has(callName)) {
    return 'computed';
  }

  if (
    callName.startsWith('emit') ||
    callName.startsWith('on') ||
    callName.includes('Event') ||
    callName.startsWith('$emit')
  ) {
    return 'event';
  }

  if (funcBody && funcBody.includes(`.${callName}(`)) {
    return 'method';
  }

  if (
    funcBody &&
    (funcBody.includes(`import { ${callName} }`) || funcBody.includes(`import ${callName}`))
  ) {
    return 'import';
  }

  return 'direct';
}

// ============================================
// ГЕНЕРАЦИЯ ИНДЕКСОВ
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

  for (const [filePath] of Object.entries(entitiesMap)) {
    const fileId = generateFileId(filePath);
    const moduleName = path.basename(path.dirname(filePath));

    fileIndex[fileId] = shortenPath(filePath);
    fileIdMap.set(filePath, fileId);

    const moduleId = generateModuleId(moduleName);
    moduleIndex[moduleId] = moduleName;
  }

  for (const [filePath, entities] of Object.entries(entitiesMap)) {
    for (const func of entities.functions || []) {
      let id: string;

      if (idFormat === 'compact') {
        id = idManager.generateCompactId({
          filePath: filePath,
          funcName: func.name,
          line: func.line || 0,
          parentFunction: func.parentFunction,
          depth: func.depth || 0,
          type: 'function',
        });
      } else {
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
// ПОСТРОЕНИЕ CALL GRAPH
// ============================================

function buildCallGraphEdges(
  entitiesMap: Record<string, EntitiesResult>,
  functionIdMap: Map<string, string>
): UltraCallGraphEdge[] {
  const edges: UltraCallGraphEdge[] = [];

  for (const [_filePath, entities] of Object.entries(entitiesMap)) {
    for (const func of entities.functions || []) {
      const callerId = func.id;
      if (!callerId) continue;

      const calls = func.calls || [];
      for (const callName of calls) {
        const targetId = functionIdMap.get(callName);
        if (targetId && targetId !== callerId) {
          edges.push({
            from: callerId,
            to: targetId,
            line: func.line || 0,
            type: detectCallType(callName, func.body || ''),
          });
        }
      }
    }
  }

  return edges;
}

// ============================================
// РЕЗОЛВИНГ ПУТЕЙ ИМПОРТОВ
// ============================================

function resolveImportPath(
  fromFile: string,
  importPath: string,
  entitiesMap: Record<string, EntitiesResult>,
  projectRoot: string = process.cwd()
): string | null {
  const fromDir = path.dirname(fromFile);

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
      const withoutExt = resolved.replace(/\.[^.]+$/, '');
      if (entitiesMap[withoutExt]) {
        return withoutExt;
      }
      if (!candidate.includes('.')) {
        const tsPath = resolved + '.ts';
        if (entitiesMap[tsPath]) {
          return tsPath;
        }
      }
    }

    const baseName = path.basename(importPath).replace(/\.[^.]+$/, '');
    for (const [modPath] of Object.entries(entitiesMap)) {
      const modBase = path.basename(modPath).replace(/\.[^.]+$/, '');
      if (modBase === baseName && path.dirname(modPath) === fromDir) {
        return modPath;
      }
    }

    return null;
  }

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

    const baseName = path.basename(aliasName);
    for (const [modPath] of Object.entries(entitiesMap)) {
      if (modPath.includes(baseName) || modPath.endsWith(`/${aliasName}`)) {
        return modPath;
      }
    }
  }

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
// ПОСТРОЕНИЕ IMPORT GRAPH
// ============================================

function buildImportGraphEdges(
  entitiesMap: Record<string, EntitiesResult>,
  fileIdMap: Map<string, string>,
  projectRoot: string = process.cwd()
): UltraImportGraphEdge[] {
  const edges: UltraImportGraphEdge[] = [];

  for (const [filePath, entities] of Object.entries(entitiesMap)) {
    const fromFileId = fileIdMap.get(filePath);
    if (!fromFileId) continue;

    const imports = entities.imports || [];

    for (const imp of imports) {
      const source = imp.source;
      if (!source) continue;

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

      const existingEdge = edges.find(e => e.from === fromFileId && e.to === toFileId);

      if (existingEdge) {
        const newSpecifiers = [...new Set([...existingEdge.specifiers, ...specifiers])];
        existingEdge.specifiers = newSpecifiers;
        if (importType === 'type' && existingEdge.type !== 'type') {
          existingEdge.type = 'type';
        }
      } else {
        edges.push({
          from: fromFileId,
          to: toFileId,
          specifiers,
          line: imp.loc?.start?.line || 0,
          type: importType,
        });
      }
    }
  }

  return edges;
}

// ============================================
// ИЗВЛЕЧЕНИЕ ENUM И ДЕКОРАТОРОВ
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
// ОСНОВНАЯ ФУНКЦИЯ (СУЩЕСТВУЮЩАЯ)
// ============================================

export function generateCompactEntityReport(
  entitiesMap: Record<string, EntitiesResult>,
  outputPath: string,
  options: CompactReportOptions = {}
): any {
  console.log('\n🔧 Генерация компактного отчета с индексацией и графами...');
  console.log('='.repeat(60));

  // Проверяем, нужно ли использовать ultra-compact режим
  if (options.ultraCompact) {
    console.log('📋 Использую ULTRA-COMPACT режим (удаление дублей + битовые флаги)');
    return generateUltraCompactReport(entitiesMap, outputPath, options);
  }

  // Существующая логика (без изменений)
  const startTime = Date.now();
  const projectRoot = options.projectRoot || process.cwd();
  const idFormat = options.idFormat || 'compact';
  const useTemplates = options.useTemplates !== false;

  console.log(`📋 Формат ID: ${idFormat === 'compact' ? 'КОМПАКТНЫЙ (f142_704)' : 'ПОЛНЫЙ'}`);
  console.log(`📋 Шаблоны: ${useTemplates ? 'ВКЛЮЧЕНЫ' : 'ВЫКЛЮЧЕНЫ'}`);

  idManager.clear();

  // Исправлено: правильная обработка фильтров с EntityTypesFilter
  let config: PresetConfig;
  if (options.usePreset !== false) {
    config = COMPACT_REPORT_CONFIG.getConfig();
    console.log(`📋 Использую пресет: ${COMPACT_REPORT_CONFIG.activePreset}`);
  } else {
    // Полная структура для relationshipFields
    const relationshipFields: RelationshipFieldsConfig = {
      calls: {
        enabled: true,
        targetId: true,
        targetName: true,
        targetFile: true,
        targetLine: true,
        targetVscode: true,
        callLine: true,
        callType: true,
        ...(options.relationshipFields?.calls || {})
      },
      calledBy: {
        enabled: true,
        callerId: true,
        callerName: true,
        callerFile: true,
        callerLine: true,
        callerVscode: true,
        callLine: true,
        callType: true,
        ...(options.relationshipFields?.calledBy || {})
      },
      importedBy: {
        enabled: true,
        importerId: true,
        importerFile: true,
        importerVscode: true,
        importLine: true,
        specifier: true,
        importType: true,
        ...(options.relationshipFields?.importedBy || {})
      },
    };

    // Правильная обработка filters с EntityTypesFilter
    const filters: FiltersConfig = {
      entityTypes: {
        function: options.filters?.entityTypes?.function ?? true,
        class: options.filters?.entityTypes?.class ?? true,
        constant: options.filters?.entityTypes?.constant ?? true,
        interface: options.filters?.entityTypes?.interface ?? true,
        type: options.filters?.entityTypes?.type ?? true,
        variable: options.filters?.entityTypes?.variable ?? true,
        macro: options.filters?.entityTypes?.macro ?? true,
      },
      onlyExported: options.filters?.onlyExported ?? false,
      onlyNonExported: options.filters?.onlyNonExported ?? false,
      includeModules: options.filters?.includeModules ?? [],
      excludeModules: options.filters?.excludeModules ?? [],
      minComplexity: options.filters?.minComplexity ?? 0,
      maxDepth: options.filters?.maxDepth ?? Infinity,
    };

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

  console.log('\n📊 Генерация индексов...');
  const { functionIndex, functionIdMap, fileIndex, fileIdMap, moduleIndex } = generateIndices(
    entitiesMap,
    idFormat
  );

  console.log(`   📋 Индексов функций: ${Object.keys(functionIndex).length}`);
  console.log(`   📋 Индексов файлов: ${Object.keys(fileIndex).length}`);
  console.log(`   📋 Индексов модулей: ${Object.keys(moduleIndex).length}`);

  console.log('\n📦 Построение оптимизированных сущностей...');
  const rawEntities = buildOptimizedEntities(entitiesMap, functionIdMap, fileIdMap);
  console.log(`   📊 Сущностей: ${Object.keys(rawEntities).length}`);

  // 🆕 Удаляем дублирующие поля из сущностей
  console.log('\n🧹 Удаление дублирующих полей (calls, calledBy)...');
  const cleanEntities = removeDuplicateFields(rawEntities);
  console.log(`   ✅ Очищено ${Object.keys(cleanEntities).length} сущностей`);

  console.log('\n🔄 Построение графа вызовов (Call Graph)...');
  const callGraphEdges = buildCallGraphEdges(entitiesMap, functionIdMap);
  const callGraph = buildCallGraphStats(callGraphEdges);
  console.log(`   📊 Вызовов: ${callGraph?.edges.length || 0}`);

  // ❌ УДАЛЕНО: больше не нужен calledByMap, т.к. информация в callGraph
  // console.log('\n📞 Построение обратных вызовов (calledBy)...');
  // const calledByMap = buildCalledByFromCallGraph(callGraph);

  console.log('\n📥 Построение графа импортов (Import Graph)...');
  const importGraphEdges = buildImportGraphEdges(entitiesMap, fileIdMap, projectRoot);
  const importGraph = buildImportGraphStats(importGraphEdges);
  console.log(`   📊 Ребер в графе: ${importGraph?.edges.length || 0}`);

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

  let templates: Record<string, EntityTemplate> = {};
  let templateStats: { totalTemplates: number; totalEntities: number; usage: Record<string, number> } | undefined = undefined;

  if (useTemplates) {
    console.log('\n📋 Создание шаблонов для оптимизации...');
    templates = buildTemplates(rawEntities);
    console.log(`   📊 Создано шаблонов: ${Object.keys(templates).length}`);

    const templateUsage: Record<string, number> = {};
    const optimizedEntities: Record<string, any> = {};

    for (const [id, entity] of Object.entries(rawEntities)) {
      const templateKey = getEntityTemplateKey(entity);
      templateUsage[templateKey] = (templateUsage[templateKey] || 0) + 1;

      const optimizedEntity: any = {
        $t: templateKey,
      };

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

    templateStats = {
      totalTemplates: Object.keys(templates).length,
      totalEntities: Object.keys(optimizedEntities).length,
      usage: templateUsage,
    };
  } else {
    console.log('\n⏭️ Шаблоны отключены, используем полные сущности');
    templateStats = undefined;
  }

  let totalCalls = 0;
  let totalCalledBy = 0;
  let totalFunctions = 0;
  // ✅ totalImportedBy будет вычислена из importGraph

  for (const entity of Object.values(rawEntities)) {
    if (entity.kind === 'function') {
      totalFunctions++;
      if (entity.calls) totalCalls += entity.calls.length;
      if (entity.calledBy) totalCalledBy += entity.calledBy.length;
    }
  }

  const totalFiles = Object.keys(fileIndex).length;
  const totalModules = Object.keys(moduleIndex).length;

  console.log('\n📄 Формирование отчета...');

  // Формируем отчет с чистыми сущностями
  const report: any = {
    version: '3.0.2',
    timestamp: new Date().toISOString(),
    templates: useTemplates ? templates : undefined,
    functionIndex,
    fileIndex,
    moduleIndex,
    entities: cleanEntities, // ✅ БЕЗ calls и calledBy
    callGraph,
    importGraph,
    stats: {
      totalFunctions,
      totalCalls: callGraph?.edges?.length || 0,
      totalCalledBy: callGraph?.edges?.length || 0,
      totalImportedBy: importGraph?.edges?.length || 0,
      totalEnums,
      totalDecorators,
      totalFiles,
      totalModules,
    },
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

  if (formatting.sortEntities !== false) {
    const sortedEntities = Object.fromEntries(
      Object.entries(cleanEntities).sort((a, b) => {
        const kindOrder: Record<string, number> = {
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

  const indent = formatting.indentSize || 2;
  const json = JSON.stringify(report, null, indent);

  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(outputPath, json, 'utf-8');

  const sizeKB = (json.length / 1024).toFixed(2);

  console.log(`\n✅ Отчет сохранен: ${outputPath}`);
  console.log(`📊 Размер: ${sizeKB} KB`);
  console.log(`📊 Функций: ${totalFunctions}`);
  console.log(`📊 Вызовов: ${callGraph?.edges?.length || 0}`);
  console.log(`📊 Обратных вызовов: ${callGraph?.edges?.length || 0}`);
  console.log(`📊 Импортов: ${importGraph?.edges?.length || 0}`);
  console.log(`📊 Файлов: ${totalFiles}`);
  console.log(`📊 Модулей: ${totalModules}`);
  console.log(`📊 Enum: ${totalEnums}`);
  console.log(`📊 Декораторов: ${totalDecorators}`);
  console.log(`⏱️  Время: ${((Date.now() - startTime) / 1000).toFixed(2)} сек`);

  return report;
}

// ============================================
// НОВАЯ ФУНКЦИЯ: ULTRA-COMPACT РЕЖИМ
// ============================================

export function generateUltraCompactReport(
  entitiesMap: Record<string, EntitiesResult>,
  outputPath: string,
  options: CompactReportOptions = {}
): UltraCompactReport {
  console.log('\n🚀 Генерация ULTRA-COMPACT отчета (удаление дублей + битовые флаги)...');
  console.log('='.repeat(60));

  const startTime = Date.now();
  const projectRoot = options.projectRoot || process.cwd();
  const idFormat = options.idFormat || 'compact';
  const useTemplates = options.useTemplates !== false;
  const useBitFlags = options.useBitFlags !== false;
  const useDictionaries = options.useDictionaries !== false;
  // readableKeys пока не используется, но оставляем для будущего
  // const _readableKeys = options.readableKeys !== false;

  console.log(`📋 Формат ID: ${idFormat === 'compact' ? 'КОМПАКТНЫЙ (f142_704)' : 'ПОЛНЫЙ'}`);
  console.log(`📋 Шаблоны: ${useTemplates ? 'ВКЛЮЧЕНЫ' : 'ВЫКЛЮЧЕНЫ'}`);
  console.log(`📋 Битовые флаги: ${useBitFlags ? 'ВКЛЮЧЕНЫ' : 'ВЫКЛЮЧЕНЫ'}`);
  console.log(`📋 Словари: ${useDictionaries ? 'ВКЛЮЧЕНЫ' : 'ВЫКЛЮЧЕНЫ'}`);

  idManager.clear();

  // === 1. ГЕНЕРАЦИЯ ИНДЕКСОВ ===
  console.log('\n📊 Генерация индексов...');
  const { functionIndex, functionIdMap, fileIndex, fileIdMap, moduleIndex } = generateIndices(
    entitiesMap,
    idFormat
  );

  console.log(`   📋 Индексов функций: ${Object.keys(functionIndex).length}`);
  console.log(`   📋 Индексов файлов: ${Object.keys(fileIndex).length}`);
  console.log(`   📋 Индексов модулей: ${Object.keys(moduleIndex).length}`);

  // === 2. СБОР СЛОВАРЕЙ ===
  console.log('\n📚 Сбор словарей для параметров и типов...');

  const parameterDictionary: Record<string, string> = {};
  const typeDictionary: Record<string, string> = {};
  let paramCounter = 0;
  let typeCounter = 0;

  // Добавляем 'any' как базовый тип
  typeDictionary['t0'] = 'any';
  typeCounter = 1;

  // === 3. ОБРАБОТКА СУЩНОСТЕЙ ===
  console.log('\n📦 Обработка сущностей (без дублей)...');

  const entities: Record<string, UltraCompactEntity> = {};
  const callEdges: UltraCallGraphEdge[] = [];
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

  for (const [filePath, fileEntities] of Object.entries(entitiesMap)) {
    const fileId = fileIdMap.get(filePath);
    if (!fileId) continue;

    // Обработка enum из содержимого файла
    const content = fileContents[filePath];
    if (content) {
      const enums = extractEnumsFromContent(content);
      for (const enumItem of enums) {
        const id = `enum_${simpleHash(filePath)}_${enumItem.name}`;
        entities[id] = {
          file: fileId,
          line: enumItem.line,
          flags: enumItem.isExported ? FunctionFlags.EXPORTED : 0,
        };
        // Добавляем специальные поля для enum
        (entities[id] as any).kind = 'enum';
        (entities[id] as any).values = enumItem.values;
        (entities[id] as any).memberCount = enumItem.values.length;
        totalEnums++;
      }

      const decorators = extractDecoratorsFromContent(content);
      for (const decorator of decorators) {
        const id = `decorator_${simpleHash(filePath)}_${decorator.name}_${decorator.target}`;
        entities[id] = {
          file: fileId,
          line: decorator.line,
          flags: 0,
        };
        (entities[id] as any).kind = 'decorator';
        (entities[id] as any).name = decorator.name;
        (entities[id] as any).target = decorator.target;
        (entities[id] as any).args = decorator.args;
        totalDecorators++;
      }
    }

    for (const func of fileEntities.functions || []) {
      const id = func.id || idManager.generateCompactId({
        filePath,
        funcName: func.name,
        line: func.line || 0,
        parentFunction: func.parentFunction,
        depth: func.depth || 0,
      });

      // Индексируем имя
      functionIndex[id] = func.name;

      // === КОДИРУЕМ ФЛАГИ ===
      let flags = 0;
      if (useBitFlags) {
        if (func.isAsync) flags |= FunctionFlags.ASYNC;
        if (func.isNested) flags |= FunctionFlags.NESTED;
        if (func.isArrow) flags |= FunctionFlags.ARROW;
        if (func.isMethod) flags |= FunctionFlags.METHOD;
        if (func.isEventHandler) flags |= FunctionFlags.EVENT_HANDLER;
        if (func.isExported) flags |= FunctionFlags.EXPORTED;
      }

      // === СОЗДАЕМ СУЩНОСТЬ (БЕЗ ДУБЛЕЙ!) ===
      const entity: UltraCompactEntity = {
        file: fileId,
        line: func.line || 0,
        flags: flags,
      };

      // === ПАРАМЕТРЫ (через словарь) ===
      if (useDictionaries && func.params && func.params.length > 0) {
        const paramRefs: string[] = [];
        for (const param of func.params) {
          let paramKey = `p${paramCounter}`;
          let found = false;
          for (const [key, value] of Object.entries(parameterDictionary)) {
            if (value === param) {
              paramKey = key;
              found = true;
              break;
            }
          }
          if (!found) {
            parameterDictionary[paramKey] = param;
            paramCounter++;
          }
          paramRefs.push(paramKey);
        }
        entity.params = paramRefs;
      } else if (func.params && func.params.length > 0) {
        entity.params = func.params;
      }

      // === ТИП ВОЗВРАТА (через словарь) ===
      if (useDictionaries && func.returnType && func.returnType !== 'any') {
        let typeRef = `t${typeCounter}`;
        let found = false;
        for (const [key, value] of Object.entries(typeDictionary)) {
          if (value === func.returnType) {
            typeRef = key;
            found = true;
            break;
          }
        }
        if (!found) {
          typeDictionary[typeRef] = func.returnType;
          typeCounter++;
        }
        entity.returnType = typeRef;
      } else if (func.returnType && func.returnType !== 'any') {
        entity.returnType = func.returnType;
      }

      // === ДОПОЛНИТЕЛЬНЫЕ ПОЛЯ (только если есть) ===
      if (func.isMethod && func.className) {
        entity.className = func.className;
      }
      if (func.isNested && func.parentFunction) {
        entity.parentFunction = func.parentFunction;
      }
      if (func.isEventHandler && func.eventType) {
        entity.eventType = func.eventType;
      }
      if (func.complexity && func.complexity > 1) {
        entity.complexity = func.complexity;
      }
      if (func.body && options.entityFields?.body) {
        entity.body = func.body;
      }
      if (func.vscode && options.entityFields?.vscode) {
        entity.vscode = func.vscode;
      }
      if (func.security && options.entityFields?.security) {
        entity.security = func.security;
      }

      // === ШАБЛОН ===
      if (useTemplates) {
        const templateKey = getEntityTemplateKey(func);
        entity.template = templateKey;
      }

      entities[id] = entity;

      // === СОБИРАЕМ ВЫЗОВЫ (ТОЛЬКО ЗДЕСЬ!) ===
      for (const call of func.calls || []) {
        let targetId = functionIdMap.get(call);
        if (!targetId) {
          for (const [otherPath, otherEntities] of Object.entries(entitiesMap)) {
            const found = otherEntities.functions.find(f => f.name === call);
            if (found) {
              targetId = idManager.generateCompactId({
                filePath: otherPath,
                funcName: call,
                line: found.line || 0,
                parentFunction: found.parentFunction,
                depth: found.depth || 0,
              });
              functionIndex[targetId] = call;
              break;
            }
          }
        }

        if (targetId && targetId !== id) {
          callEdges.push({
            from: id,
            to: targetId,
            line: func.line || 0,
            type: detectCallType(call, func.body || ''),
          });
        }
      }
    }
  }

  console.log(`   📊 Сущностей: ${Object.keys(entities).length}`);
  console.log(`   📊 Уникальных параметров: ${Object.keys(parameterDictionary).length}`);
  console.log(`   📊 Уникальных типов: ${Object.keys(typeDictionary).length}`);

  // === 4. ПОСТРОЕНИЕ CALL GRAPH STATS ===
  console.log('\n🔄 Построение статистики графа вызовов...');

  const callCounts = new Map<string, number>();
  const callerCounts = new Map<string, number>();

  for (const edge of callEdges) {
    callCounts.set(edge.to, (callCounts.get(edge.to) || 0) + 1);
    callerCounts.set(edge.from, (callerCounts.get(edge.from) || 0) + 1);
  }

  const mostCalled = Array.from(callCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([functionId, count]) => ({ functionId, count }));

  const topCallers = Array.from(callerCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([functionId, count]) => ({ functionId, count }));

  const callGraphStats = {
    totalEdges: callEdges.length,
    uniqueCallers: new Set(callEdges.map(e => e.from)).size,
    uniqueCallees: new Set(callEdges.map(e => e.to)).size,
    mostCalled,
    topCallers,
  };

  // === 5. ПОСТРОЕНИЕ IMPORT GRAPH ===
  console.log('\n📥 Построение графа импортов...');
  const importEdges = buildImportGraphEdges(entitiesMap, fileIdMap, projectRoot);

  const importCounts = new Map<string, number>();
  for (const edge of importEdges) {
    importCounts.set(edge.to, (importCounts.get(edge.to) || 0) + 1);
  }

  const mostImported = Array.from(importCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([fileId, count]) => ({ fileId, count }));

  // Подсчет разрешенных/неразрешенных импортов
  let totalImports = 0;
  let resolvedImports = 0;
  for (const [filePath, entities] of Object.entries(entitiesMap)) {
    for (const imp of entities.imports || []) {
      if (imp.source) {
        totalImports++;
        const resolved = resolveImportPath(filePath, imp.source, entitiesMap, projectRoot);
        if (resolved) resolvedImports++;
      }
    }
  }

  const importGraphStats = {
    totalEdges: importEdges.length,
    uniqueImporters: new Set(importEdges.map(e => e.from)).size,
    uniqueImported: new Set(importEdges.map(e => e.to)).size,
    mostImported,
    totalImports,
    resolvedImports,
    unresolvedImports: totalImports - resolvedImports,
  };

  // === 6. ШАБЛОНЫ ===
  let templates: Record<string, EntityTemplate> = {};
  let templateStats: { totalTemplates: number; totalEntities: number; usage: Record<string, number> } | undefined = undefined;

  if (useTemplates) {
    console.log('\n📋 Создание шаблонов...');
    // Строим шаблоны из сущностей
    const rawEntitiesForTemplates: Record<string, any> = {};
    for (const [id, entity] of Object.entries(entities)) {
      // Восстанавливаем полную сущность для определения шаблона
      const fullEntity: any = {
        kind: entity.template ? 'function' : 'unknown',
        isAsync: !!(entity.flags & FunctionFlags.ASYNC),
        isNested: !!(entity.flags & FunctionFlags.NESTED),
        isArrow: !!(entity.flags & FunctionFlags.ARROW),
        isMethod: !!(entity.flags & FunctionFlags.METHOD),
        isEventHandler: !!(entity.flags & FunctionFlags.EVENT_HANDLER),
        isExported: !!(entity.flags & FunctionFlags.EXPORTED),
        params: entity.params || [],
        className: entity.className,
        parentFunction: entity.parentFunction,
        eventType: entity.eventType,
        complexity: entity.complexity,
      };
      rawEntitiesForTemplates[id] = fullEntity;
    }

    templates = buildTemplates(rawEntitiesForTemplates);
    console.log(`   📊 Создано шаблонов: ${Object.keys(templates).length}`);

    const templateUsage: Record<string, number> = {};
    for (const entity of Object.values(entities)) {
      if (entity.template) {
        templateUsage[entity.template] = (templateUsage[entity.template] || 0) + 1;
      }
    }

    templateStats = {
      totalTemplates: Object.keys(templates).length,
      totalEntities: Object.keys(entities).length,
      usage: templateUsage,
    };
  }

  // === 7. СТАТИСТИКА ===
  let totalFunctions = 0;
  let totalCalls = 0;

  for (const entity of Object.values(entities)) {
    // Считаем все сущности, которые являются функциями (по наличию флагов или шаблона)
    if (entity.template || entity.flags > 0) {
      totalFunctions++;
    }
  }
  totalCalls = callEdges.length;

  // === 8. ФОРМИРУЕМ ОТЧЕТ ===
  console.log('\n📄 Формирование отчета...');

  const report: UltraCompactReport = {
    version: '4.0.0',
    timestamp: new Date().toISOString(),

    functionIndex,
    fileIndex,
    moduleIndex,

    parameterDictionary: useDictionaries ? parameterDictionary : {},
    typeDictionary: useDictionaries ? typeDictionary : {},

    callGraph: {
      edges: callEdges,
      stats: callGraphStats,
    },

    importGraph: {
      edges: importEdges,
      stats: importGraphStats,
    },

    entities,

    templates: useTemplates ? templates : undefined,

    stats: {
      totalFunctions,
      totalCalls,
      totalCalledBy: callEdges.length,
      totalImportedBy: importEdges.length,
      totalEnums,
      totalDecorators,
      totalFiles: Object.keys(fileIndex).length,
      totalModules: Object.keys(moduleIndex).length,
    },

    templateStats,

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

  // === 9. СОХРАНЕНИЕ ===
  const json = JSON.stringify(report, null, 2);

  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(outputPath, json, 'utf-8');

  const sizeKB = (json.length / 1024).toFixed(2);
  const originalSize = 485; // KB (примерный размер оригинального файла)
  const savings = ((1 - parseFloat(sizeKB) / originalSize) * 100).toFixed(1);

  console.log(`\n✅ ULTRA-COMPACT отчет сохранен: ${outputPath}`);
  console.log(`📊 Размер: ${sizeKB} KB`);
  console.log(`📊 Экономия: ${savings}% (от ${originalSize} KB)`);
  console.log(`📊 Функций: ${totalFunctions}`);
  console.log(`📊 Вызовов: ${totalCalls}`);
  console.log(`📊 Уникальных параметров: ${Object.keys(parameterDictionary).length}`);
  console.log(`📊 Уникальных типов: ${Object.keys(typeDictionary).length}`);
  console.log(`📊 Шаблонов: ${Object.keys(templates).length}`);
  console.log(`📊 Файлов: ${Object.keys(fileIndex).length}`);
  console.log(`📊 Модулей: ${Object.keys(moduleIndex).length}`);
  console.log(`⏱️  Время: ${((Date.now() - startTime) / 1000).toFixed(2)} сек`);

  return report;
}

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ СТАТИСТИКИ ГРАФОВ
// ============================================

function buildCallGraphStats(
  edges: UltraCallGraphEdge[]
): UltraCompactReport['callGraph'] {
  const callCounts = new Map<string, number>();
  const callerCounts = new Map<string, number>();

  for (const edge of edges) {
    callCounts.set(edge.to, (callCounts.get(edge.to) || 0) + 1);
    callerCounts.set(edge.from, (callerCounts.get(edge.from) || 0) + 1);
  }

  const mostCalled = Array.from(callCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([functionId, count]) => ({ functionId, count }));

  const topCallers = Array.from(callerCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([functionId, count]) => ({ functionId, count }));

  return {
    edges,
    stats: {
      totalEdges: edges.length,
      uniqueCallers: new Set(edges.map(e => e.from)).size,
      uniqueCallees: new Set(edges.map(e => e.to)).size,
      mostCalled,
      topCallers,
    },
  };
}

function buildImportGraphStats(
  edges: UltraImportGraphEdge[]
): UltraCompactReport['importGraph'] {
  const importCounts = new Map<string, number>();
  for (const edge of edges) {
    importCounts.set(edge.to, (importCounts.get(edge.to) || 0) + 1);
  }

  const mostImported = Array.from(importCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([fileId, count]) => ({ fileId, count }));

  return {
    edges,
    stats: {
      totalEdges: edges.length,
      uniqueImporters: new Set(edges.map(e => e.from)).size,
      uniqueImported: new Set(edges.map(e => e.to)).size,
      mostImported,
      totalImports: 0, // будут заполнены позже
      resolvedImports: 0,
      unresolvedImports: 0,
    },
  };
}

// ❌ УДАЛЕНА: buildCalledByFromCallGraph (информация теперь в callGraph)

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
      if (func.depth !== undefined) entity.depth = func.depth;

      if (func.params && func.params.length > 0) entity.params = func.params;
      if (func.returnType && func.returnType !== 'any') entity.returnType = func.returnType;
      if (func.className) entity.className = func.className;
      if (func.eventType) entity.eventType = func.eventType;
      if (func.parentFunction) entity.parentFunction = func.parentFunction;

      if (func.complexity && func.complexity > 1) entity.complexity = func.complexity;
      if (func.security) entity.security = func.security;

      // ❌ УДАЛЯЕМ calls и calledBy из сущностей
      // Информация о вызовах будет только в callGraph

      entities[id] = entity;
    }
  }

  return entities;
}

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

export default {
  generateCompactEntityReport,
  generateUltraCompactReport,
  encodeFlags,
  decodeFlags,
  FunctionFlags,
  buildTemplates,
  getEntityTemplateKey,
};
