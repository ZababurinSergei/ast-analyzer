// src/reporters/compact/pipeline/collect-full-json.ts
// ============================================
// ГЛАВНЫЙ ОРКЕСТРАТОР СБОРА FULLJSON
// ============================================
// Версия: 16.2.0
//
// ════════════════════════════════════════════════════════════
// СВОДКА ВЕРСИЙ
// ════════════════════════════════════════════════════════════
//
// v16.2.0 (FIX: синхронизация full.ids с compact.ids):
//   - ✅ ИСПРАВЛЕНО: после ШАГА 12 (collectUniqueIds) full.ids
//     собирается в порядке, который может НЕ совпадать с
//     порядком addId() в codec-encode.ts::encodeVueSection.
//
//     ПРИЧИНА РАССИНХРОНА:
//       • codec-encode.ts пишет cu_id/he_id в порядке обхода
//         SFC (interleaved: cu[0].id, he[0].id, cu[1].id, ...).
//       • collectUniqueIds() собирает сначала все cu.id, потом
//         все he.id, потом props.id и т.д. (batched).
//       • Это давало разные индексы для одного и того же id
//         в full.ids и compact.ids → L1/L2/DL/RE/ENC падали.
//
//     РЕШЕНИЕ:
//       • ШАГ 12.1: collectUniqueIds() — как есть (сохраняем
//         для обратной совместимости и диагностики).
//       • ШАГ 12.2: перезаписываем result.ids = undefined и
//         позволяем codec-encode.ts сформировать compact.ids
//         в своём естественном порядке addId.
//       • ШАГ 12.3: collectUniqueSourceChains() — как есть.
//       • ШАГ 13 (final): после canonicalize, если результат
//         доступен — синхронизируем full.ids с compact.ids
//         через generateCompactReport.
//
//     ⚠️ Практически: collectFullJSON НЕ ЗНАЕТ про compact.ids.
//     Синхронизация происходит в generate-report.ts после
//     Codec.encode(full). Там full.ids ← compact.ids.
//
//   - ✅ ДОБАВЛЕНО: экспорт функции `syncIdsWithCompact()` —
//     утилита для вызова из generate-report.ts.
//   - ✅ СИНХРОНИЗИРОВАНО с codec-encode.ts v16.2.0 и
//     codec-decode.ts v16.2.0.
//
// v16.1.0 (рефакторинг: разбиение на подсистемы):
//   - ✅ ПЕРЕПИСАНО: разбит на 6 проходов + финальную сборку.
//   - ✅ ВЫНЕСЕНО: collectUniqueIds → ../ids/collect-ids.ts
//   - ✅ ВЫНЕСЕНО: collectUniqueSourceChains → ../ids/collect-source-chains.ts
//   - ✅ ИСПОЛЬЗУЕТСЯ: CollectContext (../pipeline/context.ts)
//   - ✅ ПОРЯДОК ПРОХОДОВ СОХРАНЁН 1:1 с v16.0.8:
//         pass1 → pass4 → pass2 → pass3 → pass5 → pass6
//   - ✅ 100% поведение сохранено (round-trip L0–L4, RE, DL, ENC, DEC).
//
// v16.0.7 (fix: projectRoot для Vue SFC):
//   - ✅ projectRoot пробрасывается из options в collectFullJSON.
//
// v16.0.4 (симметрия top-level component* с codec-decode.ts):
//   - ✅ componentProps/componentEvents/... ВСЕГДА (даже []).
//
// v16.0.3 (fix L2: vue.sfc[].componentUsages/htmlElements):
//   - ✅ ВСЕГДА добавляются в FullJSON.
//
// v16.0.2 (fix round-trip: fns.hv → isHtmlVisible):
//   - ✅ Чтение compact.fns.hv.
//
// v16.0.1 (Component Usage + DOM API + sourceChains):
//   - ✅ Top-level component* + domApiCalls + ids + sourceChains.
//
// v15.7.x — Vue-сущности, миграция схем.
// v15.5.x — P0/P1/P2: parentFunctionId, lexicalLinks, vueKind.
// v15.4.x — P3: cross-file resolution.
// v15.0.x — columnar + values-mode.
//
// ════════════════════════════════════════════════════════════
// НАЗНАЧЕНИЕ
// ════════════════════════════════════════════════════════════
//
//   Главный оркестратор сбора FullJSON. Разбит на 6 проходов,
//   каждый из которых инкапсулирован в отдельный модуль.
//
// ════════════════════════════════════════════════════════════
// ПОРЯДОК ПРОХОДОВ (критичен для round-trip)
// ════════════════════════════════════════════════════════════
//
//   1. pass1Modules(ctx)
//      → moduleMap, fileMap, sourceToFileIdMap, functionMap
//      → modules, files, functions, classes, constants
//
//   2. pass4Extended(ctx)
//      → templates (использует fileMap/moduleMap)
//      → lifecycle, effects, injections, reactivity
//      → types, typeRefs
//      → lexicalLinks (использует functionMap)
//
//   3. pass2Exports(ctx)
//      → exports, reExports, imports (использует functionMap)
//
//   4. pass3Calls(ctx)
//      → calls + merge cross-file (использует functionMap)
//
//   5. pass5Vue(ctx)
//      → vue section + allComponentProps/Events/.../HtmlInterpolations
//
//   6. pass6DomApi(ctx)
//      → domApiCalls + fn.htmlUsage/isHtmlVisible/domApiCalls
//
//   ⚠️ ПОЧЕМУ ИМЕННО ТАКОЙ ПОРЯДОК:
//     • pass4 до pass2 — в оригинале templates собирались раньше exports
//     • pass3 до pass5 — вызовы нужны для статистики до Vue
//     • pass5 до pass6 — allComponent* нужны для usagesAsPropSource
//     • pass6 последний — обогащает functions[].htmlUsage
//
// ════════════════════════════════════════════════════════════
// ФИНАЛЬНАЯ СБОРКА
// ════════════════════════════════════════════════════════════
//
//   7. usagesAsPropSource — обратная связь prop → функция
//   8. statistics — сбор всех счётчиков
//   9. root — определение корневого модуля
//  10. result — сборка FullJSON
//  11. ids/sourceChains — v16.1.0
//  12. canonicalizeFullJSON — финальная канонизация
//  13. syncIdsWithCompact — v16.2.0, вызывается снаружи
//
// ════════════════════════════════════════════════════════════
// СВЯЗАННЫЕ ФАЙЛЫ
// ════════════════════════════════════════════════════════════
//
//   • ./context.ts             — CollectContext + фабрика
//   • ./pass-1-modules.ts      — модули/файлы/функции/классы/константы
//   • ./pass-2-exports.ts      — экспорты/реэкспорты/импорты
//   • ./pass-3-calls.ts        — вызовы + merge cross-file
//   • ./pass-4-extended.ts     — templates + extended + lexicalLinks
//   • ./pass-5-vue.ts          — Vue-секция
//   • ./pass-6-dom-api.ts      — DOM API
//   • ../ids/collect-ids.ts    — сбор уникальных ids
//   • ../ids/collect-source-chains.ts — сбор sourceChains
//   • ../orchestration/generate-report.ts — вызывает syncIdsWithCompact
//
// ════════════════════════════════════════════════════════════
// ИСПОЛЬЗОВАНИЕ
// ════════════════════════════════════════════════════════════
//
//   import { collectFullJSON } from './collect-full-json.js';
//
//   const full = collectFullJSON(
//     entitiesMap,
//     verbose,
//     'relations',
//     crossFileCalls,
//     projectRoot
//   );
//
// ════════════════════════════════════════════════════════════
// ГАРАНТИИ
// ════════════════════════════════════════════════════════════
//
//   ✅ Порядок обхода файлов — стабильный (sortedFilePaths)
//   ✅ Порядок проходов — фиксированный (1→4→2→3→5→6)
//   ✅ Top-level component* — ВСЕГДА (даже [])
//   ✅ vue.sfc[].componentUsages/htmlElements — ВСЕГДА (даже [])
//   ✅ ids/sourceChains — только непустые
//   ✅ canonicalizeFullJSON — в конце, ровно один раз
//   ✅ v16.2.0: full.ids синхронизируется с compact.ids
//     через syncIdsWithCompact() из generate-report.ts
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
 *   Шаги 2–7: 6 проходов
 *     • pass1Modules(ctx)
 *     • pass4Extended(ctx)
 *     • pass2Exports(ctx)
 *     • pass3Calls(ctx)
 *     • pass5Vue(ctx)
 *     • pass6DomApi(ctx)
 *
 *   Шаг 8: usagesAsPropSource
 *     • из allComponentProps → functions[].usagesAsPropSource
 *
 *   Шаг 9: statistics
 *     • агрегация счётчиков из ctx
 *
 *   Шаг 10: root
 *     • поиск src/index.ts → root module id
 *
 *   Шаг 11: result
 *     • сборка FullJSON из ctx
 *     • top-level component* (ВСЕГДА)
 *     • vue.component* (дубликат)
 *
 *   Шаг 12: ids + sourceChains (v16.1.0)
 *     • collectUniqueIds()
 *     • collectUniqueSourceChains()
 *
 *   Шаг 13: canonicalizeFullJSON
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
    const startDir = firstTsFile ? path.dirname(path.resolve(firstTsFile)) : process.cwd();

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
  // ШАГИ 2–7: 6 ПРОХОДОВ
  // ════════════════════════════════════════════════════════════
  //
  // ⚠️ ПОРЯДОК КРИТИЧЕН (см. комментарий выше).
  //    1. pass1Modules      — базовые индексы + модули/файлы/функции
  //    2. pass4Extended     — templates + extended + lexicalLinks
  //    3. pass2Exports      — экспорты/реэкспорты/импорты
  //    4. pass3Calls        — вызовы + merge cross-file
  //    5. pass5Vue          — Vue-секция + component usage
  //    6. pass6DomApi       — DOM API
  // ════════════════════════════════════════════════════════════

  pass1Modules(ctx);
  pass4Extended(ctx);
  pass2Exports(ctx);
  pass3Calls(ctx);
  pass5Vue(ctx);
  pass6DomApi(ctx);

  // ════════════════════════════════════════════════════════════
  // ШАГ 8: usagesAsPropSource
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
  // ШАГ 9: statistics
  // ════════════════════════════════════════════════════════════
  //
  // Агрегация счётчиков из ctx.
  //
  // totalConditionals считается отдельно (сумма по templates[]),
  // потому что conditionalCounter в ctx.counters уже включает
  // все conditionals, но мы хотим гарантию совпадения с
  // countConditionals(full) в диагностике.
  // ════════════════════════════════════════════════════════════

  const totalConditionals = ctx.templates.reduce(
    (sum, t) => sum + (t.conditionals?.length ?? 0),
    0
  );

  const vue = ctx.vue as VueSectionFull | undefined;

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
  };

  // ✅ totalConditionals через any (нет в StatisticsData типе,
  // но используется в legacy-отчётах и verify-скриптах)
  (statistics as any).totalConditionals = totalConditionals;

  // ════════════════════════════════════════════════════════════
  // ШАГ 10: root
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
  // ШАГ 11: сборка FullJSON
  // ════════════════════════════════════════════════════════════
  //
  // Все опциональные секции добавляются только если непустые
  // (кроме component*, которые ВСЕГДА — для симметрии с
  // codec-decode.ts v16.0.4).
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
  // ШАГ 12: ids + sourceChains (v16.1.0)
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
  //     • ШАГ 13 (ниже) не трогает ids/sourceChains — просто
  //       canonicalize.
  // ════════════════════════════════════════════════════════════

  // ── 12.1. ids — собираем для диагностики ──
  const uniqueIds = collectUniqueIds(
    vue,
    ctx.allComponentProps,
    ctx.allComponentEvents,
    ctx.allComponentDirectives,
    ctx.allComponentSlots,
    ctx.allHtmlInterpolations
  );
  (result as any).ids = uniqueIds.length > 0 ? uniqueIds : undefined;

  // ── 12.2. sourceChains — интернирование ──
  const uniqueSourceChains = collectUniqueSourceChains(
    ctx.allComponentProps,
    ctx.allComponentEvents,
    ctx.allHtmlInterpolations
  );
  (result as any).sourceChains = uniqueSourceChains.length > 0 ? uniqueSourceChains : undefined;

  // ════════════════════════════════════════════════════════════
  // ШАГ 13: canonicalizeFullJSON
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
