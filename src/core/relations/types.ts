// src/core/relations/types.ts
// ============================================================
// ТИПЫ ДЛЯ RELATION-RESOLVER
// ============================================================
// Версия: 1.0.1
//
// ИЗМЕНЕНИЯ v1.0.1:
//   - ✅ ИСПРАВЛЕНО: добавлены поля importsByFileId, functionsByFileId,
//     scriptASTs в ResolverContext
//   - ✅ ИСПРАВЛЕНО: LocalBinding расширен sourceKeyKind, sourceKeyLine,
//     composableName
//   - ✅ ИСПРАВЛЕНО: InlineCall расширен functionId, source, sourceFileId,
//     importId
//   - ✅ ДОБАВЛЕНО: ImportRecord, FunctionRecord типы
//   - ✅ ДОБАВЛЕНО: ResolveResult (то, что возвращает runRelationResolver)
// ============================================================

import type { Node, SourceFile } from 'ts-morph';

// ============================================================
// VUE MACROS
// ============================================================

export type ExposedKind = 'ref' | 'function' | 'computed' | 'readonly' | 'unknown';

export interface ExposedMethod {
  name: string;
  line: number;
  kind: ExposedKind;
  source: string;
}

export interface PropDefinition {
  name: string;
  type: string;
  required: boolean;
  default: string | null;
  line: number;
}

export interface EmitDefinition {
  name: string;
  payloadType: string;
  line: number;
}

export interface ModelDefinition {
  name: string;
  propName: string;
  eventName: string;
  line: number;
}

export interface SlotDefinition {
  name: string;
  bindings: string[];
  line: number;
}

export interface OptionsDefinition {
  inheritAttrs: boolean;
  name: string | null;
}

export interface VueMacros {
  exposed: ExposedMethod[];
  props: PropDefinition[];
  emits: EmitDefinition[];
  model: ModelDefinition[];
  slots: SlotDefinition[];
  options: OptionsDefinition | null;
}

// ============================================================
// RECORD-ТИПЫ (для resolver-ов)
// ============================================================

export interface ImportRecord {
  id: string;
  fromFileId: string;
  toFileId: string | null;
  source: string;
  localName: string;
  importedName: string;
  isExternal: boolean;
  packageName?: string;
  line?: number;
}

export interface FunctionRecord {
  id: string;
  name: string;
  fileId: string;
  line: number;
  body: string;
  calls: string[];
  returnType?: string;
  isAsync?: boolean;
  isExported?: boolean;
  routeRefs?: Array<{
    path: string;
    routeName: string | null;
    componentFileId: string | null;
  }>;
  [key: string]: any;
}

// ============================================================
// REF CALLS
// ============================================================

export interface RefCall {
  refName: string;
  methodName: string;
  line: number;
  argsCount: number;
  isOptional: boolean;
  isAwait: boolean;
  returnUsed: boolean;
  resolvedTo?: RefCallResolution | null;
  warning?: string;
}

export interface RefCallResolution {
  fileId: string;
  importId: string;
  exposedMethodName: string;
  exposedMethodLine: number;
  isExternal?: boolean;
  libraryName?: string;
}

// ============================================================
// COMPOSABLES
// ============================================================

export type ReturnedKind = 'ref' | 'computed' | 'function' | 'reactive' | 'readonly' | 'unknown';

export interface ReturnedKey {
  name: string;
  kind: ReturnedKind;
  line: number;
}

export interface ComposableInfo {
  functionId: string;
  name: string;
  fileId: string;
  returnedKeys: ReturnedKey[];
  parameters: string[];
}

export interface LocalBinding {
  localName: string;
  propertyName: string;
  sourceFunctionId: string | null;
  sourceFileId: string | null;
  kind: ReturnedKind;
  line: number;

  // ✅ НОВОЕ v1.0.1: обогащённые поля
  sourceKeyKind?: ReturnedKind;
  sourceKeyLine?: number;
  composableName?: string;
}

// ============================================================
// INLINE HANDLERS
// ============================================================

export interface InlineCall {
  name: string;
  line: number;

  // ✅ НОВОЕ v1.0.1: обогащение после resolver
  functionId?: string;
  source?: 'local' | 'composable' | 'import' | 'global' | 'unresolved';
  sourceFileId?: string;
  importId?: string;
}

// ============================================================
// OBJECT MAPS
// ============================================================

export interface ObjectMap {
  name: string;
  entries: Record<string, string>;
  line: number;
}

// ============================================================
// RESOLVER CONTEXT
// ============================================================

export interface ResolverContext {
  index: GlobalIndex;
  entitiesByFileId: Map<string, any>;
  files: Map<string, any>;
  templates: Map<string, any>;
  functions: Map<string, FunctionRecord>;
  imports: ImportRecord[];
  exports: any[];
  composables: Map<string, ComposableInfo>;
  objectMaps: Map<string, ObjectMap[]>;
  vueMacros: Map<string, VueMacros>;
  refCalls: Map<string, RefCall[]>;
  localBindings: Map<string, LocalBinding[]>;

  // ✅ НОВОЕ v1.0.1: индексы для быстрого доступа
  importsByFileId: Map<string, ImportRecord[]>;
  functionsByFileId: Map<string, FunctionRecord[]>;
  scriptASTs?: Map<string, { ast: any; sourceFile: any }>;

  debug: boolean;
}

// ============================================================
// GLOBAL INDEX
// ============================================================

export interface GlobalIndex {
  componentUsers: Map<string, ComponentUser[]>;
  functionByName: Map<string, string[]>;
  componentByName: Map<string, ComponentInfo>;
  routes: RouteDefinition[];
  stores: Map<string, StoreDefinition>;
}

export interface ComponentUser {
  parentFileId: string;
  parentTemplate: any;
  localName: string;
  line: number;
}

export interface ComponentInfo {
  name: string;
  fileId: string;
}

export interface RouteDefinition {
  path: string;
  name: string | null;
  componentFileId: string | null;
  filePath: string;
}

export interface StoreDefinition {
  name: string;
  id: string;
  fileId: string;
  state: string[];
  getters: string[];
  actions: string[];
}

// ============================================================
// РЕЗУЛЬТАТ РАБОТЫ RESOLVER
// ============================================================

export interface ResolveStats {
  refCallsResolved: number;
  refCallsUnresolved: number;
  eventHandlersResolved: number;
  eventHandlersInline: number;
  composablesResolved: number;
  localBindings: number;
  propsResolved: number;
  emitsResolved: number;
  vModelsResolved: number;
  dynamicComponentsResolved: number;
  storesResolved: number;
  routesResolved: number;
  directivesResolved: number;
  durationMs: number;
}

/**
 * ✅ НОВОЕ v1.0.1: полный результат runRelationResolver.
 * Содержит и статистику, и обогащённые maps.
 */
export interface ResolveResult {
  stats: ResolveStats;
  /** Обогащённые templates по fileId */
  templates: Map<string, any>;
  /** Обогащённые vueMacros по fileId */
  vueMacros: Map<string, VueMacros>;
  /** Обогащённые localBindings по fileId */
  localBindings: Map<string, LocalBinding[]>;
  /** Обогащённые refCalls по fileId */
  refCalls: Map<string, RefCall[]>;
  /** Глобальный индекс */
  index: GlobalIndex;
}

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ
// ============================================================

export type { Node, SourceFile };
