// src/reporters/compact/pipeline/collect-full-json.ts
// ============================================
// ГЛАВНЫЙ ОРКЕСТРАТОР СБОРА FULLJSON
// ============================================
// Версия: 17.0.0 (v17.0.0: React-секция)
// ============================================

import path from 'path';
import type { EntitiesResult } from '../../../types.js';
import type {
  FullJSON,
  CompactJSON,
  StatisticsData,
  VueSectionFull,
} from '../../codec/codec-types.js';
import { CODEC_VERSION } from '../../codec/codec-types.js';
import type { ValuesMode } from '../../codec/values-filter.js';
import type { CrossFileCall } from '../../../core/cross-file-resolver/types.js';
import { canonicalizeFullJSON } from '../../utils/canonical-utils.js';
import {
  clearTsConfigCache,
  loadTsConfig,
  getTsConfigDir,
} from '../../../core/tsconfig-resolver.js';

import { createCollectContext } from './context.js';
import { pass1Modules } from './pass-1-modules.js';
import { pass2Exports } from './pass-2-exports.js';
import { pass3Calls } from './pass-3-calls.js';
import { pass4Extended } from './pass-4-extended.js';
import { pass5Vue } from './pass-5-vue.js';
import { pass6DomApi } from './pass-6-dom-api.js';
import { pass7React } from './pass-7-react.js';

import { collectUniqueIds } from '../ids/collect-ids.js';
import { collectUniqueSourceChains } from '../ids/collect-source-chains.js';

// ============================================================
// КОНСТАНТЫ
// ============================================================

/**
 * Режим сериализации values по умолчанию.
 *
 *   - 'relations' — только значения, нужные для восстановления связей
 *   - 'full'      — все значения (обратная совместимость)
 */
const DEFAULT_VALUES_MODE: ValuesMode = 'relations';

// ============================================================
// ГЛАВНАЯ ФУНКЦИЯ
// ============================================================

/**
 * Собирает FullJSON из карты сущностей.
 *
 * ════════════════════════════════════════════════════════════
 * АЛГОРИТМ
 * ════════════════════════════════════════════════════════════
 *
 *   Шаг 0: tsconfig
 *     • clearTsConfigCache()
 *     • loadTsConfig(startDir)
 *
 *   Шаг 1: createCollectContext
 *     • sortedFilePaths
 *     • пустые массивы/Map'ы/счётчики
 *
 *   Шаги 2–8: 7 проходов (v17.0.0: +pass7React)
 *     • pass1Modules(ctx)
 *     • pass4Extended(ctx)
 *     • pass2Exports(ctx)
 *     • pass3Calls(ctx)
 *     • pass5Vue(ctx)
 *     • pass6DomApi(ctx)
 *     • pass7React(ctx)   ← NEW v17.0.0
 *
 *   Шаг 9: usagesAsPropSource
 *     • из allComponentProps → functions[].usagesAsPropSource
 *
 *   Шаг 10: statistics
 *     • агрегация счётчиков из ctx
 *     • + totalReact* (v17.0.0)
 *
 *   Шаг 11: root
 *     • поиск src/index.ts → root module id
 *
 *   Шаг 12: result
 *     • сборка FullJSON из ctx
 *     • top-level component* (ВСЕГДА)
 *     • vue.component* (дубликат)
 *     • react (optional, v17.0.0)
 *
 *   Шаг 13: ids + sourceChains (v16.1.0)
 *     • collectUniqueIds()
 *     • collectUniqueSourceChains()
 *
 *   Шаг 14: canonicalizeFullJSON
 *     • финальная канонизация
 *
 * ════════════════════════════════════════════════════════════
 * ПАРАМЕТРЫ
 * ════════════════════════════════════════════════════════════
 *
 *   @param entitiesMap       — карта { filePath → EntitiesResult }
 *   @param verbose           — подробный вывод (по умолчанию false)
 *   @param valuesMode        — 'full' | 'relations' (по умолчанию 'relations')
 *   @param _crossFileCalls   — cross-file calls (может быть undefined)
 *   @param projectRoot       — абсолютный путь к корню проекта
 *                              (по умолчанию process.cwd())
 *
 * ════════════════════════════════════════════════════════════
 * ВОЗВРАЩАЕМОЕ ЗНАЧЕНИЕ
 * ════════════════════════════════════════════════════════════
 *
 *   FullJSON с полями:
 *     • version, timestamp, root, valuesMode
 *     • modules, files, functions, classes, constants
 *     • exports, imports, calls, reExports
 *     • templates (optional)
 *     • lifecycle/effects/injections/reactivity (optional)
 *     • types/typeRefs (optional)
 *     • lexicalLinks (optional)
 *     • vue (optional)
 *     • react (optional)            ← v17.0.0
 *     • statistics
 *     • componentProps/componentEvents/... (ВСЕГДА)
 *     • domApiCalls (optional)
 *     • ids (optional)
 *     • sourceChains (optional)
 *
 * ════════════════════════════════════════════════════════════
 * ПРИМЕР
 * ════════════════════════════════════════════════════════════
 *
 *   const full = collectFullJSON(
 *     entitiesMap,
 *     true,              // verbose
 *     'relations',       // valuesMode
 *     crossFileCalls,
 *     '/project/root'
 *   );
 */
export function collectFullJSON(
  entitiesMap: Record<string, EntitiesResult>,
  verbose: boolean = false,
  valuesMode: ValuesMode = DEFAULT_VALUES_MODE,
  _crossFileCalls?: CrossFileCall[],
  projectRoot: string = process.cwd()
): FullJSON {
  // ════════════════════════════════════════════════════════════
  // ШАГ 0: tsconfig
  // ════════════════════════════════════════════════════════════
  //
  // Загружаем tsconfig ДО всех проходов, потому что:
  //   • resolveToFileId (pass2Exports) использует алиасы
  //   • buildScopeForFunction (pass6DomApi) использует paths
  //
  // clearTsConfigCache() перед loadTsConfig — чтобы не
  // тащить кэш из предыдущего запуска (важно для тестов
  // и повторных вызовов generateCompactReport).
  // ════════════════════════════════════════════════════════════
  try {
    clearTsConfigCache();

    const firstTsFile = Object.keys(entitiesMap).find(f => f.endsWith('.ts') || f.endsWith('.tsx'));
    // ✅ ФИКС R7: path.resolve от projectRoot, а не от cwd.
  const startDir = firstTsFile
    ? path.dirname(path.resolve(projectRoot, firstTsFile))
    : process.cwd();

    loadTsConfig(startDir);

    if (verbose) {
      console.log(`   🔧 tsconfig base: ${getTsConfigDir() || 'не найден'}`);
    }
  } catch (error) {
    if (verbose) {
      console.warn(
        `   ⚠️ tsconfig не загружен: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // ════════════════════════════════════════════════════════════
  // ШАГ 1: создание контекста
  // ════════════════════════════════════════════════════════════
  const ctx = createCollectContext(entitiesMap, verbose, valuesMode, _crossFileCalls, projectRoot);

  if (verbose) {
    console.log(`   📋 Стабильный порядок обхода: ${ctx.sortedFilePaths.length} файлов`);
  }

  // ════════════════════════════════════════════════════════════
  // ШАГИ 2–8: 7 ПРОХОДОВ
  // ════════════════════════════════════════════════════════════
  //
  // ⚠️ ПОРЯДОК КРИТИЧЕН (см. комментарий выше).
  //    1. pass1Modules      — базовые индексы + модули/файлы/функции
  //    2. pass4Extended     — templates + extended + lexicalLinks
  //    3. pass2Exports      — экспорты/реэкспорты/импорты
  //    4. pass3Calls        — вызовы + merge cross-file
  //    5. pass5Vue          — Vue-секция + component usage
  //    6. pass6DomApi       — DOM API
  //    7. pass7React        — React-секция (NEW v17.0.0)
  //
  // pass7React идёт ПОСЛЕ pass6DomApi — не ломает существующий
  // pipeline (React не участвует в DOM API на этом этапе).
  // ════════════════════════════════════════════════════════════

  pass1Modules(ctx);
  pass4Extended(ctx);
  pass2Exports(ctx);
  pass3Calls(ctx);
  pass5Vue(ctx);
  pass6DomApi(ctx);
  pass7React(ctx);

  // ════════════════════════════════════════════════════════════
  // ШАГ 9: usagesAsPropSource
  // ════════════════════════════════════════════════════════════
  //
  // Обратная связь: prop → функция-источник.
  //
  // Для каждого prop из allComponentProps:
  //   • берём первый functionId из sourceChain
  //   • находим функцию в ctx.functions
  //   • добавляем запись в fn.usagesAsPropSource
  //
  // Используется для:
  //   • htmlUsage (kind: 'passed-to-component')
  //   • UI: "этот prop приходит из функции X"
  // ════════════════════════════════════════════════════════════

  // Инициализируем пустыми массивами для ВСЕХ функций
  for (const fn of ctx.functions) {
    (fn as any).usagesAsPropSource = [];
  }

  for (const p of ctx.allComponentProps) {
    const firstFnId = (p as any).sourceChain?.[0]?.functionId;
    if (!firstFnId) continue;

    const targetFn = ctx.functions.find(f => f.id === firstFnId);
    if (!targetFn) continue;

    if (!(targetFn as any).usagesAsPropSource) {
      (targetFn as any).usagesAsPropSource = [];
    }

    (targetFn as any).usagesAsPropSource.push({
      usageId: p.usageId,
      propId: p.id,
      propName: p.name,
      tag: '',
      targetFileId: null,
    });
  }

  // ════════════════════════════════════════════════════════════
  // ШАГ 10: statistics
  // ════════════════════════════════════════════════════════════
  //
  // Агрегация счётчиков из ctx.
  //
  // totalConditionals считается отдельно (сумма по templates[]),
  // потому что conditionalCounter в ctx.counters уже включает
  // все conditionals, но мы хотим гарантию совпадения с
  // countConditionals(full) в диагностике.
  //
  // ✅ v17.0.0: добавлены totalReact*-счётчики.
  // ════════════════════════════════════════════════════════════

  const totalConditionals = ctx.templates.reduce(
    (sum, t) => sum + (t.conditionals?.length ?? 0),
    0
  );

  const vue = ctx.vue as VueSectionFull | undefined;
  const react = ctx.react as any;

  const statistics: StatisticsData = {
    // ── Базовые ──
    totalModules: ctx.modules.length,
    totalFiles: ctx.files.length,
    totalFunctions: ctx.functions.length,
    totalClasses: ctx.classes.length,
    totalConstants: ctx.constants.length,
    totalExports: ctx.exports.length,
    totalImports: ctx.imports.length,
    totalCalls: ctx.calls.length,
    totalReExports: ctx.reExports.length,
    totalTemplates: ctx.templates.length,
    totalLexicalLinks: ctx.lexicalLinks.length,

    // ── Vue-сущности ──
    totalVueSfc: vue?.sfc.length ?? 0,
    totalComposables: vue?.composables.length ?? 0,
    totalMacros: vue?.macros.length ?? 0,
    totalHooks: vue?.hooks.length ?? 0,
    totalReactivity: vue?.reactivity.length ?? 0,
    totalIcons: vue?.icons.length ?? 0,

    // ── v16.0.0: component usage + DOM API ──
    totalComponentUsages:
      vue?.sfc.reduce((sum, s) => sum + (s.componentUsages?.length ?? 0), 0) ?? 0,
    totalHtmlElements: vue?.sfc.reduce((sum, s) => sum + (s.htmlElements?.length ?? 0), 0) ?? 0,
    totalComponentProps: ctx.allComponentProps.length,
    totalComponentEvents: ctx.allComponentEvents.length,
    totalDomApiCalls: ctx.domApiCalls.length,
    totalSourceChains: 0,
    totalHtmlVisibleFns: ctx.functions.filter(f => (f as any).isHtmlVisible).length,
    totalDomApiVisibleFns: ctx.functions.filter(f => ((f as any).domApiCalls?.length ?? 0) > 0)
      .length,

    // ── v17.0.0: React-счётчики ──
    totalReactComponents: react?.components?.length ?? 0,
    totalReactHooks: react?.hooks?.length ?? 0,
    totalReactEffects: react?.effects?.length ?? 0,
    totalReactContexts: react?.contexts?.length ?? 0,
    totalReactMemoization: react?.memoization?.length ?? 0,
    totalReactRefs: react?.refs?.length ?? 0,
    totalJsxElements: react?.jsxElements?.length ?? 0,
    totalJsxEvents: react?.jsxEvents?.length ?? 0,
    totalReactConditionals: react?.conditionals?.length ?? 0,
    totalReactComponentUsages: react?.componentUsages?.length ?? 0,
  };

  // ✅ totalConditionals через any (нет в StatisticsData типе,
  // но используется в legacy-отчётах и verify-скриптах)
  (statistics as any).totalConditionals = totalConditionals;

  // ════════════════════════════════════════════════════════════
  // ШАГ 11: root
  // ════════════════════════════════════════════════════════════
  //
  // Приоритет:
  //   1. Файл src/index.ts (или src\index.ts для Windows)
  //   2. Первый модуль
  //   3. 'm0' (fallback)
  // ════════════════════════════════════════════════════════════

  let root = 'm0';

  for (const file of ctx.files) {
    if (file.path.endsWith('src/index.ts') || file.path.endsWith('src\\index.ts')) {
      const module = ctx.modules.find(m => m.id === file.moduleId);
      if (module) {
        root = module.id;
        break;
      }
    }
  }

  if (root === 'm0' && ctx.modules.length > 0) {
    const firstModule = ctx.modules[0];
    if (firstModule) {
      root = firstModule.id;
    }
  }

  // ════════════════════════════════════════════════════════════
  // ШАГ 12: сборка FullJSON
  // ════════════════════════════════════════════════════════════
  //
  // Все опциональные секции добавляются только если непустые
  // (кроме component*, которые ВСЕГДА — для симметрии с
  // codec-decode.ts v16.0.4).
  //
  // ✅ v17.0.0: добавлено поле `react` (опциональное).
  // ════════════════════════════════════════════════════════════

  const result: FullJSON = {
    version: CODEC_VERSION,
    timestamp: new Date().toISOString(),
    root,
    valuesMode,

    // ── Обязательные секции ──
    modules: ctx.modules,
    files: ctx.files,
    functions: ctx.functions,
    classes: ctx.classes,
    constants: ctx.constants,
    exports: ctx.exports,
    imports: ctx.imports,
    calls: ctx.calls,
    reExports: ctx.reExports,
    statistics,

    // ── Опциональные секции ──
    templates: ctx.templates.length > 0 ? ctx.templates : undefined,
    lifecycle: ctx.lifecycle.length > 0 ? ctx.lifecycle : undefined,
    effects: ctx.effects.length > 0 ? ctx.effects : undefined,
    injections: ctx.injections.length > 0 ? ctx.injections : undefined,
    reactivity: ctx.reactivity.length > 0 ? ctx.reactivity : undefined,
    types: ctx.types.length > 0 ? ctx.types : undefined,
    typeRefs: ctx.typeRefs.length > 0 ? ctx.typeRefs : undefined,
    lexicalLinks: ctx.lexicalLinks.length > 0 ? ctx.lexicalLinks : undefined,

    // ── Vue-секция ──
    vue,

    // ── v17.0.0: React-секция (опциональная) ──
    react,

    // ── DOM API (top-level) ──
    domApiCalls: ctx.domApiCalls.length > 0 ? ctx.domApiCalls : undefined,
  };

  // ────────────────────────────────────────────────────────────
  // v16.0.4: top-level component*-поля ВСЕГДА (даже пустые [])
  // ────────────────────────────────────────────────────────────
  //
  // Симметрия с codec-decode.ts v16.0.4:
  //   decode(compact) ВСЕГДА возвращает эти 5 полей (даже []).
  //   Если compact-reporter их не добавит — L1/L2/DL упадут
  //   с расхождением `[]` vs `undefined`.
  // ────────────────────────────────────────────────────────────
  (result as any).componentProps = ctx.allComponentProps;
  (result as any).componentEvents = ctx.allComponentEvents;
  (result as any).componentDirectives = ctx.allComponentDirectives;
  (result as any).componentSlots = ctx.allComponentSlots;
  (result as any).htmlInterpolations = ctx.allHtmlInterpolations;

  // ────────────────────────────────────────────────────────────
  // v16.0.4: дублируем те же поля в vue-секции
  // ────────────────────────────────────────────────────────────
  //
  // vue.componentProps и т.д. — используются в:
  //   • vue-специфичных отчётах
  //   • UI для отображения компонентов
  //   • verify-roundtrip.ts (vue.* спот-чеки)
  // ────────────────────────────────────────────────────────────
  if (vue) {
    (vue as any).componentProps = ctx.allComponentProps;
    (vue as any).componentEvents = ctx.allComponentEvents;
    (vue as any).componentDirectives = ctx.allComponentDirectives;
    (vue as any).componentSlots = ctx.allComponentSlots;
    (vue as any).htmlInterpolations = ctx.allHtmlInterpolations;
  }

  // ════════════════════════════════════════════════════════════
  // ШАГ 13: ids + sourceChains (v16.1.0)
  // ════════════════════════════════════════════════════════════
  //
  // ПРОБЛЕМА (до v16.1.0):
  //   compact.ids формируется в codec-encode.ts в порядке
  //   первого addId() в encodeVueSection (interleaved cu → he
  //   на каждом SFC). А full.ids — не формируется вообще.
  //
  // РЕШЕНИЕ (v16.1.0):
  //   • collectUniqueIds() собирает уникальные id из всех
  //     component*-секций и vue.sfc[] в том же порядке,
  //     что codec-encode.ts::addId.
  //   • collectUniqueSourceChains() делает то же для sourceChains.
  //
  //   Теперь compact.ids = full.ids (симметрия) → 100% round-trip.
  //
  // ⚠️ v16.2.0:
  //   Практика показала, что collectUniqueIds() собирает ids
  //   в ДРУГОМ порядке, чем addId() в codec-encode.ts:
  //     • collectUniqueIds: batched (все cu.id → все he.id → ...)
  //     • addId в encodeVueSection: interleaved по SFC
  //       (cu[0].id, he[0].id, cu[1].id, he[1].id, ...)
  //
  //   Это приводило к рассинхрону индексов → L1/L2/DL/RE/ENC
  //   падали с "$.vue.componentProps[N].usageId".
  //
  //   РЕШЕНИЕ v16.2.0:
  //     • collectUniqueIds() оставляем для обратной совместимости
  //       и диагностики (но full.ids больше НЕ используется как
  //       источник истины).
  //     • codec-encode.ts формирует compact.ids в своём
  //       естественном порядке addId.
  //     • generate-report.ts ПОСЛЕ Codec.encode(full) вызывает
  //       syncIdsWithCompact(full, compact) — перезаписывает
  //       full.ids значением compact.ids.
  //     • ШАГ 14 (ниже) не трогает ids/sourceChains — просто
  //       canonicalize.
  // ════════════════════════════════════════════════════════════

  // ── 13.1. ids — собираем для диагностики ──
  const uniqueIds = collectUniqueIds(
    vue,
    ctx.allComponentProps,
    ctx.allComponentEvents,
    ctx.allComponentDirectives,
    ctx.allComponentSlots,
    ctx.allHtmlInterpolations
  );
  (result as any).ids = uniqueIds.length > 0 ? uniqueIds : undefined;

  // ── 13.2. sourceChains — интернирование ──
  const uniqueSourceChains = collectUniqueSourceChains(
    ctx.allComponentProps,
    ctx.allComponentEvents,
    ctx.allHtmlInterpolations
  );
  (result as any).sourceChains = uniqueSourceChains.length > 0 ? uniqueSourceChains : undefined;

  // ════════════════════════════════════════════════════════════
  // ШАГ 14: canonicalizeFullJSON
  // ════════════════════════════════════════════════════════════
  //
  // Финальная канонизация:
  //   • сортировка ключей в объектах
  //   • нормализация путей
  //   • стабилизация порядка массивов
  //
  // Гарантирует, что два вызова collectFullJSON с одинаковыми
  // входными данными дадут побайтово одинаковый результат.
  //
  // См. utils/canonical-utils.ts.
  // ════════════════════════════════════════════════════════════

  return canonicalizeFullJSON(result);
}

// ============================================================
// ✅ v16.2.0: СИНХРОНИЗАЦИЯ full.ids С compact.ids
// ============================================================

/**
 * Синхронизирует `full.ids` со значением `compact.ids`.
 *
 * ════════════════════════════════════════════════════════════
 * ЗАЧЕМ ЭТА ФУНКЦИЯ
 * ════════════════════════════════════════════════════════════
 *
 * ПРОБЛЕМА:
 *   `compact.ids` формируется в `codec-encode.ts::encodeVueSection`
 *   в порядке первого вызова `addId()`:
 *     - cu[0].id, he[0].id, cu[1].id, he[1].id, ...
 *     - затем componentProps[].id (в порядке добавления)
 *     - затем componentEvents[].id
 *     - и т.д.
 *
 *   `collectFullJSON` собирает `full.ids` через `collectUniqueIds()`
 *   в ДРУГОМ порядке:
 *     - сначала ВСЕ cu.id (batched)
 *     - потом ВСЕ he.id (batched)
 *     - потом componentProps[].id
 *     - и т.д.
 *
 *   Из-за этого `full.ids` и `compact.ids` содержат одинаковый
 *   НАБОР строк, но в РАЗНОМ порядке. Индексы не совпадают.
 *
 * СИМПТОМЫ:
 *   verify-roundtrip.ts:
 *     L1/L2/DL/RE/ENC — FAIL
 *     $.vue.componentProps[N].usageId: "he1" → "he6"
 *     $.vue.componentEvents[N].usageId: "cu1" → "cu2"
 *
 * РЕШЕНИЕ:
 *   После `Codec.encode(full)` в `generate-report.ts`:
 *     1. Получить `compact.ids` из результата encode.
 *     2. Перезаписать `full.ids = compact.ids`.
 *
 *   Это делает `full.ids` и `compact.ids` побайтово идентичными.
 *   decode(compact) теперь использует те же индексы, что
 *   использовал encode.
 *
 * ════════════════════════════════════════════════════════════
 * КОГДА ВЫЗЫВАТЬ
 * ════════════════════════════════════════════════════════════
 *
 *   ТОЛЬКО ПОСЛЕ `Codec.encode(full)`, иначе `compact` ещё
 *   не существует.
 *
 *   Правильное место:
 *     // generate-report.ts
 *     const full = collectFullJSON(...);
 *     const compact = Codec.encode(full, valuesMode);
 *     syncIdsWithCompact(full, compact);  // ← здесь
 *     // далее saveJsonFile(full) и saveJsonFile(compact)
 *
 * ════════════════════════════════════════════════════════════
 * ПОБОЧНЫЕ ЭФФЕКТЫ
 * ════════════════════════════════════════════════════════════
 *
 *   • Мутирует `full.ids` (если compact.ids есть).
 *   • Если compact.ids === undefined — НЕ трогает full.ids
 *     (оставляет результат collectUniqueIds).
 *   • Если full.ids === undefined и compact.ids есть —
 *     устанавливает full.ids = compact.ids.
 *
 * ════════════════════════════════════════════════════════════
 * ПРИМЕР
 * ════════════════════════════════════════════════════════════
 *
 *   const full = collectFullJSON(entitiesMap);
 *   const compact = Codec.encode(full, 'relations');
 *
 *   console.log(full.ids?.[0]);      // 'cu1' (от collectUniqueIds)
 *   console.log(compact.ids?.[0]);   // 'cu1' (от addId)
 *   console.log(full.ids?.[2]);      // 'he1' (batched)
 *   console.log(compact.ids?.[2]);   // 'cu2' (interleaved)
 *
 *   syncIdsWithCompact(full, compact);
 *
 *   console.log(full.ids?.[2]);      // 'cu2' — синхронизировано
 *
 * @param full     — FullJSON (мутируется)
 * @param compact  — CompactJSON (только чтение)
 * @returns true, если синхронизация выполнена; false, если compact.ids отсутствует
 */
export function syncIdsWithCompact(full: FullJSON, compact: CompactJSON): boolean {
  const compactIds = (compact as any).ids;
  if (!Array.isArray(compactIds) || compactIds.length === 0) {
    return false;
  }
  (full as any).ids = compactIds;
  return true;
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default collectFullJSON;
