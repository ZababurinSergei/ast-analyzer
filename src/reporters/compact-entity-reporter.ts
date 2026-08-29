// packages/ast-analyzer/src/reporters/compact-entity-reporter.ts

import fs from 'fs';
import path from 'path';
import { COMPACT_REPORT_CONFIG, type PresetConfig } from '../config.js';
import type { EntitiesResult, FunctionInfo } from '../types.js';

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
  totalFunctions?: number;
  totalCalls?: number;
  totalCalledBy?: number;
  totalImportedBy?: number;
  totalEnums?: number;
  totalDecorators?: number;
  entities: Record<string, any>;
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

function generateFunctionId(filePath: string, funcName: string): string {
  const relativePath = path.relative(process.cwd(), filePath);
  const fileHash = simpleHash(relativePath);
  return `func_${fileHash}_${funcName}`;
}

function generateFileId(filePath: string): string {
  const relativePath = path.relative(process.cwd(), filePath);
  return `file_${simpleHash(relativePath)}`;
}

// ============================================
// ОПРЕДЕЛЕНИЕ ТИПА ВЫЗОВА
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

const ARRAY_METHODS = new Set([
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'slice',
  'map',
  'filter',
  'find',
  'findIndex',
  'forEach',
  'reduce',
  'reduceRight',
  'some',
  'every',
  'includes',
  'indexOf',
  'lastIndexOf',
  'join',
  'concat',
  'reverse',
  'sort',
  'flat',
  'flatMap',
  'fill',
  'copyWithin',
  'toReversed',
  'toSorted',
  'toSpliced',
  'with',
  'findLast',
  'findLastIndex',
]);

const OPERATORS = new Set([
  'if',
  'else',
  'for',
  'while',
  'do',
  'switch',
  'case',
  'break',
  'continue',
  'return',
  'throw',
  'try',
  'catch',
  'finally',
  'debugger',
  'const',
  'let',
  'var',
  'function',
  'class',
  'extends',
  'implements',
  'interface',
  'type',
  'enum',
  'namespace',
  'module',
  'declare',
  'export',
  'import',
  'default',
  'new',
  'delete',
  'typeof',
  'instanceof',
  'void',
  'this',
  'super',
  'null',
  'undefined',
  'true',
  'false',
  'async',
  'await',
  'yield',
  'static',
  'public',
  'private',
  'protected',
  'readonly',
  'abstract',
  'override',
]);

const GLOBAL_OBJECTS = new Set([
  'console',
  'Math',
  'Date',
  'JSON',
  'Promise',
  'Symbol',
  'setTimeout',
  'setInterval',
  'clearTimeout',
  'clearInterval',
  'String',
  'Number',
  'Boolean',
  'Array',
  'Object',
  'Function',
  'Map',
  'Set',
  'WeakMap',
  'WeakSet',
  'RegExp',
  'Error',
  'Buffer',
  'process',
  '__dirname',
  '__filename',
  'require',
  'module',
  'exports',
  'URL',
  'URLSearchParams',
  'Proxy',
  'Reflect',
]);

function detectCallTypeImproved(
  callName: string,
  funcBody: string,
  currentFunctionName: string
): 'direct' | 'import' | 'array_method' | 'vue' | 'external' | 'operator' | 'self' {
  if (OPERATORS.has(callName)) return 'operator';
  if (callName === currentFunctionName) return 'self';
  if (ARRAY_METHODS.has(callName)) return 'array_method';
  if (VUE_COMPOSABLES.has(callName)) return 'vue';
  if (GLOBAL_OBJECTS.has(callName)) return 'external';
  if (funcBody.includes(`.${callName}(`)) return 'direct';
  return 'direct';
}

// ============================================
// ПОСТРОЕНИЕ ИНДЕКСА ФУНКЦИЙ
// ============================================

function buildFunctionIndex(entitiesMap: Record<string, EntitiesResult>): Map<
  string,
  {
    id: string;
    file: string;
    line: number;
    vscode: string;
    func: FunctionInfo;
  }
> {
  const index = new Map<
    string,
    {
      id: string;
      file: string;
      line: number;
      vscode: string;
      func: FunctionInfo;
    }
  >();

  for (const [filePath, entities] of Object.entries(entitiesMap)) {
    for (const func of entities.functions || []) {
      const id = func.id || generateFunctionId(filePath, func.name);
      const vscode = func.vscode || `vscode://file/${filePath}:${func.line}`;

      index.set(func.name, {
        id,
        file: filePath,
        line: func.line || 0,
        vscode,
        func,
      });

      // Также индексируем по полному имени (с модулем) для разрешения конфликтов
      const fullName = `${filePath}#${func.name}`;
      index.set(fullName, {
        id,
        file: filePath,
        line: func.line || 0,
        vscode,
        func,
      });
    }
  }

  return index;
}

// ============================================
// ПОСТРОЕНИЕ СВЯЗЕЙ МЕЖДУ ФУНКЦИЯМИ
// ============================================

function buildFunctionRelationships(
  entitiesMap: Record<string, EntitiesResult>,
  funcIndex: Map<
    string,
    { id: string; file: string; line: number; vscode: string; func: FunctionInfo }
  >
): {
  calls: Record<string, any[]>;
  calledBy: Record<string, any[]>;
  importedBy: Record<string, any[]>;
} {
  const calls: Record<string, any[]> = {};
  const calledBy: Record<string, any[]> = {};
  const importedBy: Record<string, any[]> = {};

  // Инициализация
  for (const [filePath, entities] of Object.entries(entitiesMap)) {
    for (const func of entities.functions || []) {
      const id = func.id || generateFunctionId(filePath, func.name);
      calls[id] = [];
      calledBy[id] = [];
      importedBy[id] = [];
    }
  }

  // ============================================
  // 1. Строим calls для каждой функции
  // ============================================
  for (const [filePath, entities] of Object.entries(entitiesMap)) {
    for (const func of entities.functions || []) {
      const id = func.id || generateFunctionId(filePath, func.name);
      if (!calls[id]) continue;

      const callNames = func.calls || [];
      const funcBody = func.body || '';

      for (const callName of callNames) {
        // Определяем тип вызова
        const callType = detectCallTypeImproved(callName, funcBody, func.name);

        // Пропускаем операторы и самовызовы
        if (callType === 'operator') continue;
        if (callType === 'self') continue;

        // Ищем вызываемую функцию
        let target = funcIndex.get(callName);
        let finalCallType = callType;

        // Если не нашли по имени, ищем в других файлах
        if (!target) {
          for (const [otherFile, otherEntities] of Object.entries(entitiesMap)) {
            if (otherFile === filePath) continue;
            const found = otherEntities.functions.find(f => f.name === callName);
            if (found && found.isExported) {
              const targetId = found.id || generateFunctionId(otherFile, callName);
              target = {
                id: targetId,
                file: otherFile,
                line: found.line || 0,
                vscode: found.vscode || `vscode://file/${otherFile}:${found.line}`,
                func: found,
              };
              if (callType === 'direct') {
                finalCallType = 'import';
              }
              break;
            }
          }
        }

        if (target) {
          calls[id].push({
            targetId: target.id,
            targetName: callName,
            targetFile: target.file,
            targetLine: target.line,
            targetVscode: target.vscode,
            callLine: func.line || 0,
            callType: finalCallType,
          });
        } else if (callType === 'vue' || callType === 'external') {
          // Внешние вызовы (Vue, глобальные)
          calls[id].push({
            targetId: callType === 'vue' ? `vue_${callName}` : `global_${callName}`,
            targetName: callName,
            targetFile: callType === 'vue' ? 'vue' : 'global',
            targetLine: 0,
            targetVscode: '',
            callLine: func.line || 0,
            callType: callType,
          });
        } else {
          // Если не нашли, добавляем как неизвестный вызов
          calls[id].push({
            targetId: 'unknown',
            targetName: callName,
            targetFile: 'unknown',
            targetLine: 0,
            targetVscode: '',
            callLine: func.line || 0,
            callType: 'external',
          });
        }
      }
    }
  }

  // ============================================
  // 2. Строим calledBy (обратные ссылки)
  // ============================================
  for (const [callerId, callList] of Object.entries(calls)) {
    for (const call of callList) {
      const targetId = call.targetId;
      if (
        targetId &&
        targetId !== 'unknown' &&
        !targetId.startsWith('vue_') &&
        !targetId.startsWith('global_')
      ) {
        if (calledBy[targetId]) {
          // Находим информацию о вызывающей функции
          let callerInfo = null;
          for (const [filePath, entities] of Object.entries(entitiesMap)) {
            const func = entities.functions.find(f => {
              const fId = f.id || generateFunctionId(filePath, f.name);
              return fId === callerId;
            });
            if (func) {
              callerInfo = {
                id: callerId,
                name: func.name,
                file: filePath,
                line: func.line || 0,
                vscode: func.vscode || `vscode://file/${filePath}:${func.line}`,
              };
              break;
            }
          }

          if (callerInfo) {
            // Проверяем, не добавлен ли уже такой caller
            const exists = calledBy[targetId].some((c: any) => c.callerId === callerId);
            if (!exists) {
              calledBy[targetId].push({
                callerId: callerInfo.id,
                callerName: callerInfo.name,
                callerFile: callerInfo.file,
                callerLine: callerInfo.line,
                callerVscode: callerInfo.vscode,
                callLine: call.callLine,
                callType: call.callType,
              });
            }
          }
        }
      }
    }
  }

  // ============================================
  // 3. Строим importedBy из импортов
  // ============================================
  for (const [filePath, entities] of Object.entries(entitiesMap)) {
    const imports = entities.imports || [];
    const importerId = generateFileId(filePath);
    const importerVscode = `vscode://file/${filePath}`;

    for (const imp of imports) {
      for (const spec of imp.specifiers) {
        let importedName: string | undefined;
        let localName: string | undefined;

        if (typeof spec === 'string') {
          importedName = spec;
          localName = spec;
        } else if (spec && typeof spec === 'object') {
          importedName = spec.imported || spec.local;
          localName = spec.local || spec.imported;
        }

        if (!importedName) continue;

        const target = funcIndex.get(importedName);
        if (target && target.file !== filePath) {
          const targetId = target.id;
          if (importedBy[targetId]) {
            // Проверяем, не добавлен ли уже такой импортер
            const exists = importedBy[targetId].some(
              (i: any) => i.importerFile === filePath && i.specifier === (localName || importedName)
            );
            if (!exists) {
              importedBy[targetId].push({
                importerId: importerId,
                importerFile: filePath,
                importerVscode: importerVscode,
                importLine: (imp as any).loc?.start?.line || 0,
                specifier: localName || importedName,
                importType: (imp as any).isTypeOnly ? 'type' : 'named',
              });
            }
          }
        }
      }
    }
  }

  return { calls, calledBy, importedBy };
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
// ОСНОВНАЯ ФУНКЦИЯ
// ============================================

export function generateCompactEntityReport(
  entitiesMap: Record<string, EntitiesResult>,
  outputPath: string,
  options: CompactReportOptions = {}
): CompactEntityReport {
  console.log('\n🔧 Генерация компактного отчета сущностей (УЛУЧШЕННАЯ ВЕРСИЯ)...');
  console.log('='.repeat(60));

  const startTime = Date.now();

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

  // Объединяем с переданными опциями
  const entityFields = { ...config.entityFields, ...(options.entityFields || {}) } as Record<
    string,
    boolean
  >;
  const relFields = {
    calls: {
      ...(config.relationshipFields?.calls || {}),
      ...(options.relationshipFields?.calls || {}),
    } as Record<string, boolean>,
    calledBy: {
      ...(config.relationshipFields?.calledBy || {}),
      ...(options.relationshipFields?.calledBy || {}),
    } as Record<string, boolean>,
    importedBy: {
      ...(config.relationshipFields?.importedBy || {}),
      ...(options.relationshipFields?.importedBy || {}),
    } as Record<string, boolean>,
  };
  const filters = { ...(config.filters || {}), ...(options.filters || {}) } as {
    entityTypes?: Record<string, boolean>;
    onlyExported?: boolean;
    onlyNonExported?: boolean;
    includeModules?: string[];
    excludeModules?: string[];
    minComplexity?: number;
    maxDepth?: number;
  };
  const formatting = { ...(config.formatting || {}), ...(options.formatting || {}) } as {
    indentSize?: number;
    sortKeys?: boolean;
    sortEntities?: boolean;
    includeTimestamp?: boolean;
    includeStats?: boolean;
  };

  console.log(
    `📋 Поля сущностей: ${Object.entries(entityFields).filter(([, v]) => v).length} включено`
  );
  console.log(`📋 Calls: ${relFields.calls.enabled ? 'включены' : 'выключены'}`);
  console.log(`📋 CalledBy: ${relFields.calledBy.enabled ? 'включены' : 'выключены'}`);
  console.log(`📋 ImportedBy: ${relFields.importedBy.enabled ? 'включены' : 'выключены'}`);

  // === 2. СОЗДАНИЕ СУЩНОСТЕЙ ===
  const entities: Record<string, any> = {};
  let totalFunctions = 0;
  let totalEnums = 0;
  let totalDecorators = 0;

  // Сокращаем пути
  function shortenPath(filePath: string): string {
    if (!filePath) return '';
    try {
      const relative = path.relative(process.cwd(), filePath);
      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        return filePath.replace(/^.*[\\/](?:packages[\\/])?/, '');
      }
      return relative.replace(/\\/g, '/');
    } catch {
      return filePath.replace(/^.*[\\/](?:packages[\\/])?/, '');
    }
  }

  // Получаем содержимое файлов для извлечения enum и декораторов
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

  // Извлекаем enum и декораторы
  for (const [filePath, content] of Object.entries(fileContents)) {
    if (!content) continue;

    // Проверка фильтра модулей
    if (options.filters?.excludeModules?.some((m: string) => filePath.includes(m))) continue;
    if (
      options.filters?.includeModules?.length &&
      !options.filters.includeModules.some((m: string) => filePath.includes(m))
    )
      continue;

    const shortPath = shortenPath(filePath);

    // Извлекаем enum
    const enums = extractEnumsFromContent(content);
    for (const enumItem of enums) {
      if (filters.entityTypes && filters.entityTypes.enum === false) continue;

      const id = `enum_${simpleHash(shortPath)}_${enumItem.name}`;
      const entity: any = {
        id: id,
        name: enumItem.name,
        file: shortPath,
        line: enumItem.line,
        kind: 'enum',
        vscode: `vscode://file/${shortPath}:${enumItem.line}`,
        values: enumItem.values,
        isExported: enumItem.isExported,
        memberCount: enumItem.values.length,
        calls: [],
        calledBy: [],
        importedBy: [],
      };
      entities[id] = entity;
      totalEnums++;
    }

    // Извлекаем декораторы
    const decorators = extractDecoratorsFromContent(content);
    for (const decorator of decorators) {
      if (filters.entityTypes && filters.entityTypes.decorator === false) continue;

      const id = `decorator_${simpleHash(shortPath)}_${decorator.name}_${decorator.target}`;
      const entity: any = {
        id: id,
        name: decorator.name,
        file: shortPath,
        line: decorator.line,
        kind: 'decorator',
        vscode: `vscode://file/${shortPath}:${decorator.line}`,
        target: decorator.target,
        args: decorator.args,
        calls: [],
        calledBy: [],
        importedBy: [],
      };
      entities[id] = entity;
      totalDecorators++;
    }
  }

  // Создаем функции
  for (const [filePath, fileEntities] of Object.entries(entitiesMap)) {
    // Проверка фильтра модулей
    if (options.filters?.excludeModules?.some((m: string) => filePath.includes(m))) continue;
    if (
      options.filters?.includeModules?.length &&
      !options.filters.includeModules.some((m: string) => filePath.includes(m))
    )
      continue;

    const shortPath = shortenPath(filePath);

    for (const func of fileEntities.functions || []) {
      // Фильтр по типу сущности
      if (filters.entityTypes && filters.entityTypes.function === false) continue;

      // Фильтр по экспорту
      if (filters.onlyExported && !func.isExported) continue;
      if (filters.onlyNonExported && func.isExported) continue;

      // Фильтр по сложности
      if ((func.complexity || 0) < (filters.minComplexity || 0)) continue;

      // Фильтр по глубине
      if ((func.depth || 0) > (filters.maxDepth || Infinity)) continue;

      const id = func.id || generateFunctionId(filePath, func.name);
      const vscode = func.vscode || `vscode://file/${shortPath}:${func.line}`;

      const entity: any = {
        id,
        name: func.name,
        file: shortPath,
        line: func.line || 0,
        kind: 'function',
        vscode: vscode,
        isExported: func.isExported || false,
        isAsync: func.isAsync || false,
        params: func.params || [],
        paramsCount: (func.params || []).length,
        returnType: func.returnType || 'any',
        isMethod: func.isMethod || false,
        className: func.className || '',
        isNested: func.isNested || false,
        parentFunction: func.parentFunction || '',
        isArrow: func.isArrow || false,
        isEventHandler: func.isEventHandler || false,
        eventType: func.eventType || '',
        depth: func.depth || 0,
        complexity: func.complexity || 1,
        startLine: func.startLine || func.line || 0,
        endLine: func.endLine || func.line || 0,
        calls: [],
        calledBy: [],
        importedBy: [],
      };

      entities[id] = entity;
      totalFunctions++;
    }
  }

  console.log(
    `📊 Создано сущностей: функций ${totalFunctions}, enum ${totalEnums}, декораторов ${totalDecorators}`
  );

  // === 3. ПОСТРОЕНИЕ ИНДЕКСА ФУНКЦИЙ ===
  console.log('🔗 Построение индекса функций...');
  const funcIndex = buildFunctionIndex(entitiesMap);
  console.log(`   📊 Индексировано функций: ${funcIndex.size}`);

  // === 4. ПОСТРОЕНИЕ ВЫЗОВОВ (CALLS) ===
  console.log('🔗 Построение вызовов (calls)...');

  const relationships = buildFunctionRelationships(entitiesMap, funcIndex);

  let totalCalls = 0;
  let totalCalledBy = 0;
  let totalImportedBy = 0;

  // Добавляем связи в сущности
  for (const [id, callList] of Object.entries(relationships.calls)) {
    if (entities[id]) {
      entities[id].calls = callList;
      totalCalls += callList.length;
    }
  }

  for (const [id, calledByList] of Object.entries(relationships.calledBy)) {
    if (entities[id]) {
      entities[id].calledBy = calledByList;
      totalCalledBy += calledByList.length;
    }
  }

  for (const [id, importedByList] of Object.entries(relationships.importedBy)) {
    if (entities[id]) {
      entities[id].importedBy = importedByList;
      totalImportedBy += importedByList.length;
    }
  }

  console.log(`📞 Вызовов (calls): ${totalCalls}`);
  console.log(`📞 Обратных вызовов (calledBy): ${totalCalledBy}`);
  console.log(`📥 Импортеров (importedBy): ${totalImportedBy}`);

  // === 5. ФОРМИРОВАНИЕ ОТЧЕТА ===
  const report: CompactEntityReport = {
    version: '3.0.0',
    entities: {},
  };

  if (formatting.includeTimestamp !== false) {
    report.timestamp = new Date().toISOString();
  }

  if (formatting.includeStats !== false) {
    report.totalFunctions = totalFunctions;
    report.totalCalls = totalCalls;
    report.totalCalledBy = totalCalledBy;
    report.totalImportedBy = totalImportedBy;
    report.totalEnums = totalEnums;
    report.totalDecorators = totalDecorators;
  }

  // Сортировка сущностей
  let sortedEntities = entities;
  if (formatting.sortEntities !== false) {
    sortedEntities = Object.fromEntries(
      Object.entries(entities).sort((a, b) => {
        const kindOrder = { function: 0, enum: 1, decorator: 2 };
        const aOrder = kindOrder[a[1].kind as keyof typeof kindOrder] ?? 99;
        const bOrder = kindOrder[b[1].kind as keyof typeof kindOrder] ?? 99;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return a[1].name.localeCompare(b[1].name);
      })
    );
  }

  report.entities = sortedEntities;

  // === 6. СОХРАНЕНИЕ ===
  const indent = formatting.indentSize || 2;
  const json = JSON.stringify(report, null, indent);

  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(outputPath, json, 'utf-8');

  // === 7. СТАТИСТИКА ===
  const sizeKB = (json.length / 1024).toFixed(2);
  console.log(`\n✅ Компактный отчет сохранен: ${outputPath}`);
  console.log(`📊 Размер: ${sizeKB} KB`);
  console.log(`📊 Функций: ${totalFunctions}`);
  console.log(`📊 Enum: ${totalEnums}`);
  console.log(`📊 Декораторов: ${totalDecorators}`);
  console.log(`📞 Вызовов (calls): ${totalCalls}`);
  console.log(`📞 Обратных вызовов (calledBy): ${totalCalledBy}`);
  console.log(`📥 Импортеров (importedBy): ${totalImportedBy}`);
  console.log(`⏱️  Время: ${((Date.now() - startTime) / 1000).toFixed(2)} сек`);

  // Проверка наличия связей
  const entitiesWithCalls = Object.values(report.entities).filter(
    e => e.calls && e.calls.length > 0
  );
  const entitiesWithCalledBy = Object.values(report.entities).filter(
    e => e.calledBy && e.calledBy.length > 0
  );
  const entitiesWithImportedBy = Object.values(report.entities).filter(
    e => e.importedBy && e.importedBy.length > 0
  );

  console.log(`\n📊 СТАТИСТИКА СВЯЗЕЙ:`);
  console.log(`   🔗 Сущностей с вызовами (calls): ${entitiesWithCalls.length}`);
  console.log(`   🔗 Сущностей с обратными вызовами (calledBy): ${entitiesWithCalledBy.length}`);
  console.log(`   📥 Сущностей с импортерами (importedBy): ${entitiesWithImportedBy.length}`);

  if (entitiesWithCalls.length > 0) {
    const sample = entitiesWithCalls[0];
    console.log(`   📋 Пример: ${sample.name} → ${sample.calls.length} вызовов`);
    for (const call of sample.calls.slice(0, 3)) {
      console.log(`      📞 ${call.targetName} (${call.callType})`);
    }
  }

  if (entitiesWithImportedBy.length > 0) {
    const sample = entitiesWithImportedBy[0];
    console.log(`   📋 Пример импортеров: ${sample.name} → ${sample.importedBy.length} импортеров`);
    for (const imp of sample.importedBy.slice(0, 3)) {
      console.log(`      📥 ${imp.importerFile} (${imp.specifier})`);
    }
  }

  if (entitiesWithCalls.length === 0 && entitiesWithImportedBy.length === 0) {
    console.log(`\n⚠️ Внимание: связи между функциями не найдены`);
    console.log(`   Проверьте, что в проекте есть вызовы функций и они правильно резолвятся`);
  }

  return report;
}

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

export default generateCompactEntityReport;
