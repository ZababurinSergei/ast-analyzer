// src/core/relations/relation-resolver.ts
// ============================================================
// ОРКЕСТРАТОР RESOLVER-ОВ
// ============================================================
// Версия: 1.0.1
//
// ИЗМЕНЕНИЯ v1.0.1:
//   - ✅ ИСПРАВЛЕНО: возвращает ResolveResult (stats + обогащённые maps)
//   - ✅ ИСПРАВЛЕНО: убраны неиспользуемые импорты
//     (FileIndexEntry, FunctionIndexEntry, SourceFile, Node)
//   - ✅ ИСПРАВЛЕНО: добавлены importsByFileId, functionsByFileId
//     в ResolverContext
//   - ✅ ИСПРАВЛЕНО: убран неиспользуемый параметр `tsProject`
//     из RelationResolverOptions
//   - ✅ ИСПРАВЛЕНО: типы функций — Map<string, FunctionRecord>
//     (вместо Map<string, any>)
//   - ✅ ИСПРАВЛЕНО: импорты типов — ImportRecord[] (вместо any[])
//
// Назначение
// ----------
// Единая точка входа для всех resolver-ов. Запускает их в
// правильном порядке, обогащает templates и возвращает полный
// результат со статистикой.
//
// Порядок resolver-ов ВАЖЕН:
//   1. composables        — обогащение localBindings
//   2. event-handlers     — использует localBindings
//   3. ref-calls          — использует global-index
//   4. props              — использует vueMacros и localBindings
//   5. v-models           — использует vueMacros целевого файла
//   6. dynamic-components — использует objectMaps
//   7. emits              — использует global-index.componentUsers
//   8. stores             — использует global-index.stores
//   9. router             — использует global-index.routes
//  10. directives         — использует imports и localBindings
// ============================================================

import type {
  ResolverContext,
  ResolveResult,
  ResolveStats,
  ComposableInfo,
  LocalBinding,
  RefCall,
  VueMacros,
  ObjectMap,
  ImportRecord,
  FunctionRecord,
} from './types.js';

import { buildGlobalIndex } from './global-index.js';
import { extractVueMacros } from './vue-macros-extractor.js';
import { extractRefCalls } from './ref-calls-extractor.js';
import { extractComposableReturns, extractLocalBindings } from './composable-extractor.js';
import { extractObjectMaps } from './object-map-extractor.js';

import { resolveRefCalls } from './resolvers/ref-call-resolver.js';
import { resolveEventHandlers } from './resolvers/event-handler-resolver.js';
import { resolveComposables } from './resolvers/composable-resolver.js';
import { resolveProps } from './resolvers/props-resolver.js';
import { resolveEmits } from './resolvers/emits-resolver.js';
import { resolveVModels } from './resolvers/v-model-resolver.js';
import { resolveDynamicComponents } from './resolvers/dynamic-component-resolver.js';
import { resolveStores } from './resolvers/store-resolver.js';
import { resolveRouter } from './resolvers/router-resolver.js';
import { resolveDirectives } from './resolvers/directive-resolver.js';

// ============================================================
// ОПЦИИ
// ============================================================

export interface RelationResolverOptions {
  /** Все файлы: fileId → FileData */
  files: Map<string, any>;

  /** Все templates: fileId → TemplateData */
  templates: Map<string, any>;

  /** Все функции: functionId → FunctionRecord */
  functions: Map<string, FunctionRecord>;

  /** Все импорты */
  imports: ImportRecord[];

  /** Все экспорты */
  exports: any[];

  /**
   * AST-бандлы по fileId: { ast, sourceFile }.
   * Нужны для vue-macros-extractor, ref-calls-extractor,
   * composable-extractor, object-map-extractor.
   */
  scriptASTs?: Map<string, { ast: any; sourceFile: any }>;

  /** Подробный вывод */
  debug?: boolean;
}

// ============================================================
// ГЛАВНАЯ ФУНКЦИЯ
// ============================================================

/**
 * Запускает все resolver-ы и возвращает полный результат.
 *
 * @param options — опции
 * @returns ResolveResult — статистика + обогащённые maps
 */
export function runRelationResolver(options: RelationResolverOptions): ResolveResult {
  const startTime = Date.now();
  const { files, templates, functions, imports, exports, scriptASTs, debug = false } = options;

  if (debug) {
    console.log('\n🔗 Relation Resolver v1.0.1');
    console.log(`   Файлов: ${files.size}`);
    console.log(`   Templates: ${templates.size}`);
    console.log(`   Функций: ${functions.size}`);
    console.log(`   Импортов: ${imports.length}`);
    if (scriptASTs) {
      console.log(`   AST-бандлов: ${scriptASTs.size}`);
    }
  }

  // ──────────────────────────────────────────────────────
  // ШАГ 1: Глобальный индекс
  // ──────────────────────────────────────────────────────
  const index = buildGlobalIndex({
    files,
    templates,
    functions,
    debug,
  });

  // ──────────────────────────────────────────────────────
  // ШАГ 2: Индексы для быстрого доступа
  // ──────────────────────────────────────────────────────
  const importsByFileId = new Map<string, ImportRecord[]>();
  for (const imp of imports) {
    const list = importsByFileId.get(imp.fromFileId) ?? [];
    list.push(imp);
    importsByFileId.set(imp.fromFileId, list);
  }

  const functionsByFileId = new Map<string, FunctionRecord[]>();
  for (const [, func] of functions) {
    const list = functionsByFileId.get(func.fileId) ?? [];
    list.push(func);
    functionsByFileId.set(func.fileId, list);
  }

  // ──────────────────────────────────────────────────────
  // ШАГ 3: Vue-макросы, object-maps
  // ──────────────────────────────────────────────────────
  const vueMacros = new Map<string, VueMacros>();
  const objectMaps = new Map<string, ObjectMap[]>();

  for (const [fileId] of files) {
    const astBundle = scriptASTs?.get(fileId);
    if (!astBundle) continue;

    const { ast, sourceFile } = astBundle;

    // 3.1. Vue-макросы
    const macros = extractVueMacros(ast, sourceFile);
    if (
      macros.exposed.length > 0 ||
      macros.props.length > 0 ||
      macros.emits.length > 0 ||
      macros.model.length > 0 ||
      macros.slots.length > 0 ||
      macros.options
    ) {
      vueMacros.set(fileId, macros);
    }

    // 3.2. Object-maps
    const maps = extractObjectMaps(ast, sourceFile);
    if (maps.length > 0) {
      objectMaps.set(fileId, maps);
    }
  }

  // ──────────────────────────────────────────────────────
  // ШАГ 4: Composables (returnedKeys)
  // ──────────────────────────────────────────────────────
  const composables = new Map<string, ComposableInfo>();

  for (const [funcId, func] of functions) {
    if (!func.name.startsWith('use')) continue;

    const astBundle = scriptASTs?.get(func.fileId);
    if (!astBundle) continue;

    const composable = extractComposableReturns(
      func.name,
      funcId,
      func.fileId,
      astBundle.sourceFile
    );

    if (composable) {
      composables.set(func.name, composable);
    }
  }

  // ──────────────────────────────────────────────────────
  // ШАГ 5: Local bindings (деструктуризация composables)
  // ──────────────────────────────────────────────────────
  const localBindings = new Map<string, LocalBinding[]>();

  for (const [fileId] of files) {
    const astBundle = scriptASTs?.get(fileId);
    if (!astBundle) continue;

    const bindings = extractLocalBindings(astBundle.ast, astBundle.sourceFile, composables);

    if (bindings.length > 0) {
      localBindings.set(fileId, bindings);
    }
  }

  // ──────────────────────────────────────────────────────
  // ШАГ 6: Ref-calls
  // ──────────────────────────────────────────────────────
  const refCalls = new Map<string, RefCall[]>();

  for (const [fileId, template] of templates) {
    const astBundle = scriptASTs?.get(fileId);
    if (!astBundle) continue;

    const refNames = new Set<string>();
    for (const tr of template.templateRefs ?? []) {
      if (tr.refValue) refNames.add(tr.refValue);
    }

    if (refNames.size === 0) continue;

    const calls = extractRefCalls(astBundle.ast, astBundle.sourceFile, refNames);

    if (calls.length > 0) {
      refCalls.set(fileId, calls);
    }
  }

  // ──────────────────────────────────────────────────────
  // ШАГ 7: Контекст для resolver-ов
  // ──────────────────────────────────────────────────────
  const ctx: ResolverContext = {
    index,
    entitiesByFileId: new Map(),
    files,
    templates,
    functions,
    imports,
    exports,
    composables,
    objectMaps,
    vueMacros,
    refCalls,
    localBindings,
    importsByFileId,
    functionsByFileId,
    scriptASTs,
    debug,
  };

  // ──────────────────────────────────────────────────────
  // ШАГ 8: Запуск resolver-ов в правильном порядке
  // ──────────────────────────────────────────────────────
  const composableStats = resolveComposables(ctx);
  const eventStats = resolveEventHandlers(ctx);
  const refStats = resolveRefCalls(ctx);
  const propsResolved = resolveProps(ctx);
  const vModelResolved = resolveVModels(ctx);
  const dynResolved = resolveDynamicComponents(ctx);
  const emitsResolved = resolveEmits(ctx);
  const storesResolved = resolveStores(ctx);
  const routesResolved = resolveRouter(ctx);
  const dirResolved = resolveDirectives(ctx);

  // ──────────────────────────────────────────────────────
  // ШАГ 9: Обогащение templates
  // ──────────────────────────────────────────────────────
  for (const [fileId, template] of templates) {
    const macros = vueMacros.get(fileId);

    if (macros) {
      // ✅ Обогащаем template полями из Vue-макросов
      (template as any).exposedMethods = macros.exposed;
      (template as any).props = macros.props;
      (template as any).models = macros.model;
      (template as any).slotDefinitions = macros.slots;
      if (macros.options) (template as any).options = macros.options;

      // Emits из макроса — объединяем с template.emits
      const existingEmits = new Set<string>(
        (template.emits ?? []).map((e: any) => (typeof e === 'string' ? e : e.name))
      );

      for (const m of macros.emits) {
        if (!existingEmits.has(m.name)) {
          template.emits = template.emits ?? [];
          template.emits.push({
            name: m.name,
            payloadType: m.payloadType,
            line: m.line,
          });
        }
      }
    }

    // Ref-calls
    const calls = refCalls.get(fileId);
    if (calls) {
      (template as any).refCalls = calls;
    }

    // Local bindings
    const bindings = localBindings.get(fileId);
    if (bindings) {
      (template as any).localBindings = bindings;
    }
  }

  // ──────────────────────────────────────────────────────
  // Финальная статистика
  // ──────────────────────────────────────────────────────
  const durationMs = Date.now() - startTime;

  const stats: ResolveStats = {
    refCallsResolved: refStats,
    refCallsUnresolved: countUnresolved(refCalls),
    eventHandlersResolved: eventStats.resolved,
    eventHandlersInline: eventStats.inline,
    composablesResolved: composableStats.composables,
    localBindings: composableStats.bindings,
    propsResolved,
    emitsResolved,
    vModelsResolved: vModelResolved,
    dynamicComponentsResolved: dynResolved,
    storesResolved,
    routesResolved,
    directivesResolved: dirResolved,
    durationMs,
  };

  if (debug) {
    console.log('\n✅ Relation Resolver завершён:');
    console.log(`   refCalls: ${stats.refCallsResolved} (unresolved: ${stats.refCallsUnresolved})`);
    console.log(
      `   eventHandlers: ${stats.eventHandlersResolved} (inline: ${stats.eventHandlersInline})`
    );
    console.log(`   composables: ${stats.composablesResolved} (bindings: ${stats.localBindings})`);
    console.log(`   props: ${stats.propsResolved}`);
    console.log(`   emits: ${stats.emitsResolved}`);
    console.log(`   vModels: ${stats.vModelsResolved}`);
    console.log(`   dynamicComponents: ${stats.dynamicComponentsResolved}`);
    console.log(`   stores: ${stats.storesResolved}`);
    console.log(`   routes: ${stats.routesResolved}`);
    console.log(`   directives: ${stats.directivesResolved}`);
    console.log(`   ⏱  ${durationMs}ms`);
  }

  // ──────────────────────────────────────────────────────
  // Возврат ResolveResult
  // ──────────────────────────────────────────────────────
  return {
    stats,
    templates,
    vueMacros,
    localBindings,
    refCalls,
    index,
  };
}

// ============================================================
// ПОДСЧЁТ НЕРАЗРЕШЁННЫХ REF-CALLS
// ============================================================

/**
 * Считает ref-calls, которые не были разрешены
 * (ни resolvedTo, ни warning не установлены).
 */
function countUnresolved(refCalls: Map<string, RefCall[]>): number {
  let count = 0;

  for (const [, list] of refCalls) {
    for (const rc of list) {
      if (!rc.resolvedTo && !rc.warning) {
        count++;
      }
    }
  }

  return count;
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default { runRelationResolver };
