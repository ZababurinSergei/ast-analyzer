// src/core/relations/index.ts
// ============================================================
// ЕДИНАЯ ТОЧКА ВХОДА ДЛЯ RELATION-RESOLVER
// ============================================================
// Версия: 1.0.1
//
// ИЗМЕНЕНИЯ v1.0.1:
//   - ✅ ИСПРАВЛЕНО: экспорт `runRelationResolver` и типа
//     `RelationResolverOptions` синхронизирован с новым
//     `ResolveResult` (v1.0.1 types.ts)
//   - ✅ ДОБАВЛЕНО: экспорт типа `ResolveResult`
//   - ✅ ДОБАВЛЕНО: экспорт типов `ImportRecord`, `FunctionRecord`
//     (используются resolver-ами и внешними потребителями)
// ============================================================

// ============================================================
// 1. ОСНОВНОЙ ОРКЕСТРАТОР
// ============================================================

export { runRelationResolver } from './relation-resolver.js';
export type { RelationResolverOptions } from './relation-resolver.js';

// ============================================================
// 2. ТИПЫ
// ============================================================

export type {
  // Vue-макросы
  VueMacros,
  ExposedMethod,
  PropDefinition,
  EmitDefinition,
  ModelDefinition,
  SlotDefinition,
  OptionsDefinition,
  ExposedKind,

  // Ref-calls
  RefCall,
  RefCallResolution,

  // Composables
  ComposableInfo,
  ReturnedKey,
  ReturnedKind,
  LocalBinding,

  // Inline handlers
  InlineCall,

  // Object maps
  ObjectMap,

  // Record-типы для resolver-ов
  ImportRecord,
  FunctionRecord,

  // Контекст
  ResolverContext,
  GlobalIndex,
  ComponentUser,
  ComponentInfo,
  RouteDefinition,
  StoreDefinition,

  // Результат
  ResolveStats,
  ResolveResult,
} from './types.js';

// ============================================================
// 3. ЭКСТРАКТОРЫ (для тестов и внешних потребителей)
// ============================================================

export { extractVueMacros } from './vue-macros-extractor.js';
export { extractRefCalls } from './ref-calls-extractor.js';
export { extractComposableReturns, extractLocalBindings } from './composable-extractor.js';
export { extractObjectMaps } from './object-map-extractor.js';
export { extractCallsFromInlineHandler, isInlineHandler } from './inline-handler-extractor.js';

// ============================================================
// 4. GLOBAL INDEX
// ============================================================

export { buildGlobalIndex, toPascalCase, toKebabCase } from './global-index.js';
export type { BuildIndexOptions } from './global-index.js';

// ============================================================
// 5. РЕЗОЛВЕРЫ (для тестов и внешних потребителей)
// ============================================================

export { resolveRefCalls } from './resolvers/ref-call-resolver.js';
export { resolveEventHandlers } from './resolvers/event-handler-resolver.js';
export { resolveComposables } from './resolvers/composable-resolver.js';
export { resolveProps } from './resolvers/props-resolver.js';
export { resolveEmits } from './resolvers/emits-resolver.js';
export { resolveVModels } from './resolvers/v-model-resolver.js';
export { resolveDynamicComponents } from './resolvers/dynamic-component-resolver.js';
export { resolveStores } from './resolvers/store-resolver.js';
export { resolveRouter } from './resolvers/router-resolver.js';
export { resolveDirectives } from './resolvers/directive-resolver.js';

// ============================================================
// 6. КОНСТАНТЫ МОДУЛЯ
// ============================================================

export const RELATIONS_VERSION = '1.0.1';
export const RELATIONS_NAME = '@newkind/ast-analyzer/core/relations';
