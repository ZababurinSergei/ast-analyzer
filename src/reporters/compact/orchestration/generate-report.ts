// src/reporters/compact/orchestration/generate-report.ts
// ============================================
// ГЕНЕРАЦИЯ КОМПАКТНОГО ОТЧЁТА
// ============================================
// Версия: 16.2.0
//
// ════════════════════════════════════════════════════════════
// СВОДКА ВЕРСИЙ
// ════════════════════════════════════════════════════════════
//
// v16.2.0 (FIX: синхронизация full.ids с compact.ids):
//   - ✅ ДОБАВЛЕНО: вызов `syncIdsWithCompact(full, compact)`
//     сразу после `Codec.encode(full, valuesMode)`.
//
//     ПРИЧИНА:
//       collectFullJSON формирует full.ids через
//       collectUniqueIds() в batched-порядке (все cu.id →
//       все he.id → ...). А codec-encode.ts::encodeVueSection
//       формирует compact.ids в interleaved-порядке
//       (cu[0].id, he[0].id, cu[1].id, he[1].id, ...).
//       Индексы не совпадают → L1/L2/DL/RE/ENC падают с
//       "$.vue.componentProps[N].usageId: \"he1\" → \"he6\"".
//
//     РЕШЕНИЕ:
//       После encode() перезаписываем full.ids значением
//       compact.ids. Теперь full.ids и compact.ids
//       побайтово идентичны → decode(compact) использует
//       те же индексы, что использовал encode.
//
//   - ✅ ИМПОРТИРОВАНО: `syncIdsWithCompact` из
//     `../pipeline/collect-full-json.js`.
//   - ✅ СИНХРОНИЗИРОВАНО с codec-encode.ts v16.2.0,
//     collect-full-json.ts v16.2.0.
//
// v16.0.7 (fix: projectRoot):
//   - ✅ projectRoot пробрасывается в collectFullJSON.
//
// v16.0.4 (симметрия top-level component*):
//   - ✅ componentProps/componentEvents/... ВСЕГДА (даже []).
//
// v16.0.3 (fix L2: vue.sfc[].componentUsages/htmlElements):
//   - ✅ ВСЕГДА добавляются в FullJSON.
//
// v16.0.2:
//   - ✅ valuesMode читается из compact.json.
//
// v13.0.0:
//   - ✅ valuesMode.
//
// v9.0.0:
//   - Базовая структура.
//
// ════════════════════════════════════════════════════════════
// НАЗНАЧЕНИЕ
// ════════════════════════════════════════════════════════════
//
//   Полный цикл генерации компактного отчёта:
//     1. collectFullJSON(entitiesMap) → full
//     2. Codec.encode(full) → compact
//     3. syncIdsWithCompact(full, compact) — v16.2.0
//     4. saveJsonFile(full) + saveJsonFile(compact)
//     5. (опционально) saveJsonFile(edges)
//
//   Возвращает GenerateReportResult с full, compact, путями
//   и статистикой.
//
// ════════════════════════════════════════════════════════════
// АРХИТЕКТУРА
// ════════════════════════════════════════════════════════════
//
//   ┌──────────────────────────────────────────────────┐
//   │  generateCompactReport(entitiesMap, outputPath)  │
//   │                                                  │
//   │   1. collectFullJSON                             │
//   │        ↓                                          │
//   │   2. Codec.encode                                │
//   │        ↓                                          │
//   │   3. syncIdsWithCompact  ← v16.2.0               │
//   │        ↓                                          │
//   │   4. saveJsonFile (compact + full + edges)       │
//   │        ↓                                          │
//   │   5. return GenerateReportResult                 │
//   └──────────────────────────────────────────────────┘
//
// ════════════════════════════════════════════════════════════
// ИСПОЛЬЗОВАНИЕ
// ════════════════════════════════════════════════════════════
//
//   const result = generateCompactReport(
//     entitiesMap,
//     './out/index.json',
//     {
//       valuesMode: 'relations',
//       projectRoot: '/abs/path/to/project',
//       verbose: true,
//     }
//   );
//
//   console.log(result.compactPath);   // './out/index.json'
//   console.log(result.fullPath);      // './out/index.full.json'
//
// ============================================

import path from 'path';
import type { EntitiesResult } from '../../../types.js';
import { Codec } from '../../codec/codec.js';
import type { GenerateReportOptions, GenerateReportResult } from '../../codec/codec-types.js';
import type { ValuesMode } from '../../codec/values-filter.js';
import { collectFullJSON, syncIdsWithCompact } from '../pipeline/collect-full-json.js';
import { saveJsonFile } from '../persistence/save-json.js';
import { insertSuffixBeforeExtension, insertUniqueSuffix } from '../persistence/path-utils.js';
import { countConditionals } from '../diagnostics/count-conditionals.js';

// ============================================================
// КОНСТАНТЫ
// ============================================================

/**
 * Режим сериализации values по умолчанию.
 *
 *   - 'relations' — только значения, нужные для восстановления связей
 *   - 'full'      — все значения
 */
const DEFAULT_VALUES_MODE: ValuesMode = 'relations';

// ============================================================
// ГЛАВНАЯ ФУНКЦИЯ
// ============================================================

/**
 * Генерирует компактный отчёт из карты сущностей.
 *
 * ════════════════════════════════════════════════════════════
 * АЛГОРИТМ
 * ════════════════════════════════════════════════════════════
 *
 *   1. collectFullJSON(entitiesMap, ...) → full
 *   2. Codec.encode(full, valuesMode) → compact
 *   3. syncIdsWithCompact(full, compact) — v16.2.0
 *   4. saveJsonFile(compact) + saveJsonFile(full) + saveJsonFile(edges)
 *   5. return GenerateReportResult
 *
 * ════════════════════════════════════════════════════════════
 * ПАРАМЕТРЫ
 * ════════════════════════════════════════════════════════════
 *
 *   @param entitiesMap — карта { filePath → EntitiesResult }
 *   @param outputPath  — путь для сохранения (опционально)
 *   @param options     — GenerateReportOptions
 *
 * ════════════════════════════════════════════════════════════
 * ВОЗВРАЩАЕМОЕ ЗНАЧЕНИЕ
 * ════════════════════════════════════════════════════════════
 *
 *   GenerateReportResult:
 *     • full          — FullJSON
 *     • compact       — CompactJSON (если compress !== false)
 *     • compactPath   — путь к compact.json
 *     • fullPath      — путь к full.json
 *     • edgesPath     — путь к edges.json (если saveEdges)
 *     • stats         — статистика
 *
 * ════════════════════════════════════════════════════════════
 * ПРИМЕР
 * ════════════════════════════════════════════════════════════
 *
 *   const result = generateCompactReport(
 *     entitiesMap,
 *     './out/index.json',
 *     { valuesMode: 'relations', verbose: true }
 *   );
 *
 *   console.log(`Compact: ${result.stats.compactSize} B`);
 *   console.log(`Full: ${result.stats.fullSize} B`);
 *   console.log(`Ratio: ${result.stats.compressionRatio.toFixed(2)}%`);
 *
 * @param entitiesMap — карта { filePath → EntitiesResult }
 * @param outputPath  — путь для сохранения (опционально)
 * @param options     — GenerateReportOptions
 * @returns GenerateReportResult
 */
export function generateCompactReport(
  entitiesMap: Record<string, EntitiesResult>,
  outputPath?: string,
  options: GenerateReportOptions = {}
): GenerateReportResult {
  // ────────────────────────────────────────────────────────────
  // 0. Параметры
  // ────────────────────────────────────────────────────────────
  const startTime = Date.now();
  const verbose = options.verbose === true;
  const useCompression = options.compress !== false;
  const saveFull = options.saveFullJson !== false && options.saveFull !== false;
  const fullSuffix = options.fullJsonSuffix || '.full.json';
  const valuesMode: ValuesMode = options.valuesMode || DEFAULT_VALUES_MODE;
  const projectRoot = options.projectRoot || process.cwd();

  if (verbose) {
    console.log(`   🏠 projectRoot: ${projectRoot}`);
  }

  const saveEdges = options.saveEdges === true;
  const edgesSuffix = options.edgesJsonSuffix || '.edges.json';

  // ────────────────────────────────────────────────────────────
  // 1. Сбор FullJSON
  // ────────────────────────────────────────────────────────────
  if (verbose) {
    console.log('\n📦 [compact-reporter] Сбор полного JSON...');
    console.log(`   🎛️  valuesMode: ${valuesMode}`);
  }

  const full = collectFullJSON(entitiesMap, verbose, valuesMode, undefined, projectRoot);

  if (verbose) {
    logFullStats(full);
  }

  // ────────────────────────────────────────────────────────────
  // 2. Round-trip проверка (только в verbose)
  // ────────────────────────────────────────────────────────────
  if (verbose && useCompression) {
    const verification = Codec.verifyRoundTrip(full, { valuesMode });
    if (!verification.ok) {
      console.warn(`   ⚠️  Round-trip проверка не пройдена: ${verification.error}`);
    } else {
      console.log('   ✅ Round-trip проверка пройдена');
    }
  }

  // ────────────────────────────────────────────────────────────
  // 3. Кодирование
  // ────────────────────────────────────────────────────────────
  let compact;
  if (useCompression) {
    compact = Codec.encode(full, valuesMode);

    // ✅ v16.2.0: синхронизация full.ids с compact.ids
    //
    // После encode compact.ids сформирован в естественном
    // порядке addId() в codec-encode.ts. Перезаписываем
    // full.ids — теперь они идентичны.
    //
    // Без этого L1/L2/DL/RE/ENC падают с расхождениями
    // вида "$.vue.componentProps[N].usageId: \"he1\" → \"he6\"".
    const synced = syncIdsWithCompact(full, compact);

    if (verbose) {
      console.log(
        `   🗜️  Сжатие применено (v${compact.v}, valuesMode: ${compact.valuesMode || 'undefined'})`
      );
      console.log(`   📦 values[]: ${compact.values?.length ?? 0} элементов`);
      console.log(
        `   🆔 ids синхронизированы: ${synced ? `ДА (${compact.ids?.length ?? 0} шт.)` : 'НЕТ'}`
      );
      if (compact.vue) {
        console.log(`   📦 compact.vue.sfc.f: ${compact.vue.sfc.f.length}`);
      }
    }
  }

  // ────────────────────────────────────────────────────────────
  // 4. Сохранение на диск
  // ────────────────────────────────────────────────────────────
  let compactPath: string | undefined;
  let fullPath: string | undefined;
  let edgesPath: string | undefined;
  let compactSize: number | undefined;
  let fullSize: number | undefined;
  let edgesSize: number | undefined;
  let compressionRatio: number | undefined;

  if (outputPath) {
    // 4.1. Резолвим путь для full.json
    let fullPathResolved: string | undefined;
    if (saveFull) {
      fullPathResolved = insertSuffixBeforeExtension(outputPath, fullSuffix);
      if (path.resolve(fullPathResolved) === path.resolve(outputPath)) {
        fullPathResolved = insertUniqueSuffix(outputPath, fullSuffix);
      }
    }

    // 4.2. Сохраняем compact
    if (compact) {
      const saved = saveJsonFile(outputPath, compact, 'Сжатый JSON', verbose);
      compactPath = saved.path;
      compactSize = saved.size;
    }

    // 4.3. Сохраняем full
    if (saveFull && fullPathResolved) {
      const saved = saveJsonFile(fullPathResolved, full, 'Полный JSON', verbose);
      fullPath = saved.path;
      fullSize = saved.size;

      if (compactPath && path.resolve(compactPath) === path.resolve(fullPath)) {
        console.error(
          `   ❌ [compact-reporter] КРИТИЧЕСКАЯ ОШИБКА: compactPath и fullPath совпадают: ${compactPath}`
        );
      }
    }

    // 4.4. Сохраняем edges (опционально)
    if (saveEdges && compact) {
      const edgesPathResolved = insertSuffixBeforeExtension(outputPath, edgesSuffix);
      const fullWithEdges = Codec.decode(compact, { includeEdges: true, valuesMode });
      const edges = fullWithEdges.edges || [];

      const edgesPayload = {
        version: fullWithEdges.version,
        timestamp: fullWithEdges.timestamp,
        root: fullWithEdges.root,
        valuesMode,
        edges,
        stats: {
          totalEdges: edges.length,
          byType: edges.reduce((acc: Record<string, number>, e) => {
            acc[e.type] = (acc[e.type] || 0) + 1;
            return acc;
          }, {}),
        },
      };

      const saved = saveJsonFile(
        edgesPathResolved,
        edgesPayload,
        `Edges JSON (${edges.length} edges)`,
        verbose
      );
      edgesPath = saved.path;
      edgesSize = saved.size;
    }

    // 4.5. Compression ratio
    if (compactSize !== undefined && fullSize !== undefined && fullSize > 0) {
      compressionRatio = (compactSize / fullSize) * 100;
      if (verbose) {
        console.log(`   📉 Сжатие: ${compressionRatio.toFixed(1)}% от полного размера`);
      }
    }
  }

  // ────────────────────────────────────────────────────────────
  // 5. Итоги
  // ────────────────────────────────────────────────────────────
  const duration = Date.now() - startTime;

  if (verbose) {
    console.log(`   ⏱️  Время: ${(duration / 1000).toFixed(2)}s`);
    console.log('✅ [compact-reporter] Готово\n');
  }

  return {
    full,
    compact,
    compactPath,
    fullPath,
    edgesPath,
    stats: {
      duration,
      compactSize,
      fullSize,
      edgesSize,
      compressionRatio,
      valuesMode,
      valuesCount: compact?.values?.length ?? 0,
    },
  };
}

// ============================================================
// VERBOSE-ЛОГИРОВАНИЕ СТАТИСТИКИ FULL
// ============================================================

/**
 * Логирует статистику FullJSON в verbose-режиме.
 *
 * ════════════════════════════════════════════════════════════
 * ЧТО ЛОГИРУЕТСЯ
 * ════════════════════════════════════════════════════════════
 *
 *   • Базовые счётчики (modules/files/functions/...)
 *   • Vue-секция (sfc/composables/macros/hooks/reactivity/icons)
 *   • Component Usage (componentUsages/htmlElements)
 *   • DOM API (domApiCalls)
 *   • Диагностика parentFunctionId (сколько функций имеют)
 *   • Диагностика vueKind (сколько функций классифицировано)
 *   • Диагностика callKind (сколько вызовов классифицировано)
 *   • Диагностика unresolved импортов
 *
 * @param full — FullJSON
 */
function logFullStats(full: any): void {
  // ── Базовые счётчики ──
  console.log(`   📊 Модулей: ${full.modules.length}`);
  console.log(`   📄 Файлов: ${full.files.length}`);
  console.log(`   ƒ  Функций: ${full.functions.length}`);
  console.log(`   📦 Классов: ${full.classes?.length || 0}`);
  console.log(`   📌 Констант: ${full.constants?.length || 0}`);
  console.log(`   📤 Экспортов: ${full.exports?.length || 0}`);
  console.log(`   📥 Импортов: ${full.imports?.length || 0}`);
  console.log(`   📞 Вызовов: ${full.calls?.length || 0}`);
  console.log(`   🔄 Реэкспортов: ${full.reExports?.length || 0}`);
  console.log(`   🎨 Vue-шаблонов: ${full.templates?.length || 0}`);
  console.log(`   🎯 Conditionals: ${countConditionals(full)}`);
  console.log(`   🧬 Lifecycle: ${full.lifecycle?.length || 0}`);
  console.log(`   ⚡ Effects: ${full.effects?.length || 0}`);
  console.log(`   💉 Injections: ${full.injections?.length || 0}`);
  console.log(`   🔄 Reactivity: ${full.reactivity?.length || 0}`);
  console.log(`   📐 Types: ${full.types?.length || 0}`);
  console.log(`   🔗 TypeRefs: ${full.typeRefs?.length || 0}`);
  console.log(`   🧩 LexicalLinks: ${full.lexicalLinks?.length || 0}`);

  // ── Vue-секция ──
  if (full.vue) {
    console.log(`   📦 Vue SFC: ${full.vue.sfc.length}`);
    console.log(`   ◇  Composables: ${full.vue.composables.length}`);
    console.log(`   ⚙  Macros: ${full.vue.macros.length}`);
    console.log(`   ⚓ Hooks: ${full.vue.hooks.length}`);
    console.log(`   ⚡ Reactivity: ${full.vue.reactivity.length}`);
    console.log(`   🖼  Icons: ${full.vue.icons.length}`);
  }

  // ── Component Usage + DOM API ──
  console.log(`   🌐 ComponentUsages: ${(full as any).componentUsages?.length || 0}`);
  console.log(`   🖥  DomApiCalls: ${full.domApiCalls?.length || 0}`);
  console.log(`   🌿 HtmlVisibleFns: ${full.statistics.totalHtmlVisibleFns || 0}`);

  // ── Диагностика parentFunctionId ──
  const fnsWithParent = (full.functions || []).filter((f: any) => f.parentFunctionId).length;
  console.log(`   🧬 Функций с parentFunctionId: ${fnsWithParent}/${full.functions.length}`);

  // ── Диагностика vueKind ──
  const fnsWithVueKind = (full.functions || []).filter(
    (f: any) => f.vueKind !== undefined && f.vueKind !== null
  ).length;
  const fnsNonFunctionVueKind = (full.functions || []).filter(
    (f: any) => f.vueKind !== undefined && f.vueKind !== null && f.vueKind !== 'function'
  ).length;

  console.log(
    `   🎯 Функций с vueKind: ${fnsWithVueKind}/${full.functions.length} ` +
      `(не 'function': ${fnsNonFunctionVueKind})`
  );

  if (full.functions.length > 0 && fnsWithVueKind < full.functions.length * 0.5) {
    console.warn(
      `   ⚠️  vueKind отсутствует у ${full.functions.length - fnsWithVueKind}/${full.functions.length} функций`
    );
  }

  // ── Диагностика parentFunctionId (целостность) ──
  const fnIdSet = new Set((full.functions || []).map((f: any) => f.id));
  const badParents = (full.functions || []).filter(
    (f: any) => f.parentFunctionId && !fnIdSet.has(f.parentFunctionId)
  );
  if (badParents.length > 0) {
    console.warn(
      `   ⚠️  Функций с parentFunctionId, ссылающимся на несуществующий ID: ${badParents.length}`
    );
  }

  // ── Диагностика callKind ──
  const callsWithKind = (full.calls || []).filter((c: any) => c.callKind).length;
  console.log(`   🎯 Вызовов с callKind: ${callsWithKind}/${full.calls.length}`);

  // ── Диагностика unresolved импортов ──
  const unresolvedImports = (full.imports || []).filter(
    (imp: any) => !imp.isExternal && imp.toFileId?.startsWith('unresolved:')
  );
  if (unresolvedImports.length > 0) {
    console.log(`   ⚠️  Неразрешённых импортов: ${unresolvedImports.length}`);
  } else {
    console.log(`   ✅ Все импорты разрешены`);
  }
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default generateCompactReport;
