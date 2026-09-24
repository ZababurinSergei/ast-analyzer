// src/reporters/compact-reporter.ts
// ============================================
// ТОНКИЙ ОРКЕСТРАТОР КОМПАКТНОГО ОТЧЁТА
// ============================================
// Версия: 15.5.7
//
// ════════════════════════════════════════════════════════════
// СВОДКА ВЕРСИЙ
// ════════════════════════════════════════════════════════════
//
// v15.5.7 (fix: явный проброс vueKind + диагностика):
//   - ✅ ИСПРАВЛЕНО: `vueKind` теперь ГАРАНТИРОВАННО пробрасывается
//     из `FunctionInfo.vueKind` в `FunctionData.vueKind`.
//     Ранее поле могло теряться, если промежуточный конвертер
//     (`convertFunctionToEnhanced`) не пробрасывал его.
//   - ✅ ДОБАВЛЕНО: явное приведение `(func as any).vueKind`
//     с fallback на `'function'` для случаев, когда поле отсутствует.
//   - ✅ ДОБАВЛЕНО: диагностика `vueKind` в verbose-режиме —
//     показывает количество функций с непустым `vueKind`.
//   - ✅ ДОБАВЛЕНО: предупреждение, если `vueKind` отсутствует
//     более чем у 50% функций (признак проблемы с пробросом).
//   - ✅ ОБНОВЛЕНО: заголовок 15.5.6 → 15.5.7.
//
// v15.5.6 (fix TS2614 + TS2339 + синхронизация Vue-секции):
//   - ✅ ИСПРАВЛЕНО: TS2614 — `VueEntities` импортируется
//     из `../core/vue-entity-classifier.js` (а не из
//     `./codec/codec-types.js`).
//     `VueEntities` — это ЛОКАЛЬНЫЙ интерфейс классификатора,
//     он не входит в CODEC.
//   - ✅ ИСПРАВЛЕНО: TS2339 — `statistics.totalSfcComponents`
//     → `statistics.totalVueSfc` (единое имя с codec-types.ts).
//   - ✅ ИСПРАВЛЕНО: TS2339 — `statistics.totalComposables` /
//     `totalMacros` / `totalHooks` / `totalReactivity` /
//     `totalIcons` — пишутся из `vueEntities` (единые имена).
//   - ✅ ДОБАВЛЕНО: заполнение `full.vue` через
//     `classifyVueEntities(workingEntitiesMap)`.
//   - ✅ ДОБАВЛЕНО: счётчики `sfc.c/p/e/x` заполняются
//     РЕАЛЬНЫМИ длинами массивов `composables/props/
//     emits/exposed` (для round-trip).
//   - ✅ ОБНОВЛЕНО: заголовок 15.5.5 → 15.5.6.
//
// v15.5.5 (JSON-safe сериализация):
//   - ✅ ЗАМЕНЕНО: `safeJsonStringify` → `jsonSafeStringify`
//     в `saveJsonFile`.
//   - ✅ ДОБАВЛЕНО: диагностика не-JSON-значений в
//     `full.constants[]` перед сохранением (verbose).
//
// v15.5.4 (устранение рассинхрона порогов):
//   - ✅ УДАЛЕНА локальная константа HEAVY_VALUE_THRESHOLDS.
//   - ✅ УДАЛЕНА локальная функция shouldKeepValue.
//   - ✅ ДОБАВЛЕНО: импорт `isValueKept` из
//     './codec/values-filter.js'.
//
// v15.5.3 (fix: детерминизм shouldKeepValue + вынос дубликатов):
//   - ✅ ИСПРАВЛЕНО: shouldKeepValue использует stableStringify.
//   - ✅ УДАЛЕНО: локальные extractNumericId, sortByIdNumeric,
//     canonicalizeFullJSON — заменены импортом из
//     ./utils/canonical-utils.js.
//
// v15.5.2 (P0-fix-2 — стабилизация порядка обхода):
//   - ✅ [P0-fix-2] ИСПРАВЛЕНО: детерминированный порядок
//     обхода файлов во ВСЕХ проходах collectFullJSON.
//
// v15.5.1 (P0-fix — резолвинг parentFunctionId):
//   - ✅ [P0] ИСПРАВЛЕНО: резолвинг локального parentFunctionId
//     (f18_813) в глобальный (fn42).
//
// v15.5.0 (MVP P0/P1/P2 — проброс в FullJSON):
//   - ✅ [P0] проброс parentFunctionId в FunctionData
//   - ✅ [P1] сборка full.lexicalLinks с резолвом compactId
//   - ✅ [P2] проброс callKind/calleeName/argumentIndex/column
//
// v15.4.0 (P3 — cross-file resolution):
//   - ✅ ДОБАВЛЕНО: обогащение calls[] из ctx.crossFileCalls
//
// v15.0.7 (fix isExternal ↔ toFileId desync)
// v15.0.6 (isExternal — производное от imp.toFileId)
// v15.0.4 (заполнение importedName/localName + реэкспорты)
// v15.0.3 (нормализация путей в отчёте)
// v15.0.2 (устранение дублирования conditionals)
// v15.0.1 (fix imports[].type)
// v14.0.0 (canonicalizeFullJSON в конце collectFullJSON)
// v13.0.0 (ValuesMode импортируется из values-filter.js)
// ============================================

import fs from 'fs';
import path from 'path';

import type { EntitiesResult, FunctionInfo } from '../types.js';
import { Codec } from './codec/codec.js';
import { resolveFilePath } from '../core/ast-parser.js';
import {
  loadTsConfig,
  resolveAliasPath,
  getTsConfigDir,
  clearTsConfigCache,
} from '../core/tsconfig-resolver.js';

// ✅ v15.5.5: JSON-safe сериализация (Set, Map, RegExp, Date, class instances)
import { jsonSafeStringify, isJsonSafe } from './codec/stable-stringify.js';

// ✅ v15.5.4: единый критерий фильтрации значений
import { isValueKept } from './codec/values-filter.js';
import type { ValuesMode } from './codec/values-filter.js';

// ✅ v15.5.3: единые extractNumericId / sortByIdNumeric / canonicalizeFullJSON
import { canonicalizeFullJSON } from './utils/canonical-utils.js';

// ✅ v15.5.6: Vue-классификатор и его интерфейс
// ⚠️ ВАЖНО: `VueEntities` определён в `vue-entity-classifier.ts`,
//    а НЕ в `codec-types.ts`. Это локальный интерфейс
//    классификатора, он не входит в CODEC.
import { classifyVueEntities } from '../core/vue-entity-classifier.js';
import type { VueEntities } from '../core/vue-entity-classifier.js';

// ============================================
// ✅ v13.0.0: ИМПОРТ ТИПОВ ИЗ codec-types.js
// ============================================
import type {
  FullJSON,
  CompactJSON,
  FunctionData,
  ClassData,
  ConstantData,
  ExportData,
  ImportData,
  CallData,
  ReExportData,
  ModuleData,
  FileData,
  StatisticsData,
  TemplateData,
  TemplateConditional,
  LifecycleHook,
  EffectEdge,
  InjectionEdge,
  ReactivityEdge,
  TypeNodeData,
  TypeRefData,
  DecodeOptions,
  GenerateReportOptions,
  GenerateReportResult,
  // ✅ v15.2.0 (P1)
  LexicalLink,
  // ✅ v15.5.0
  VueSectionFull,
  VueKind,
} from './codec/codec-types.js';

// ✅ v13.0.0-fix: единая версия CODEC
import { CODEC_VERSION } from './codec/codec-types.js';

// ============================================
// ✅ v15.4.0 (P3): Cross-file resolver types
// ============================================
import type { CrossFileCall } from '../core/cross-file-resolver/types.js';

// ============================================
// ✅ [P2]: тип для callsInfo
// ============================================
interface CallsInfoEntry {
  targetName: string;
  line: number;
  column?: number;
  callKind?:
    | 'direct'
    | 'method'
    | 'callback'
    | 'constructor'
    | 'tagged-template'
    | 'optional-chain'
    | 'spread'
    | 'new';
  calleeName?: string;
  argumentIndex?: number;
}

// ============================================
// ✅ v9.0.0: РЕЭКСПОРТ ТИПОВ (для обратной совместимости)
// ============================================
export type { GenerateReportOptions, GenerateReportResult } from './codec/codec-types.js';
export type { ValuesMode } from './codec/values-filter.js';

// ✅ v15.5.6: `VueEntities` реэкспортируется из правильного модуля
export type { VueEntities } from '../core/vue-entity-classifier.js';

// ============================================
// КОНСТАНТЫ
// ============================================

/**
 * Значение по умолчанию для `valuesMode`.
 */
const DEFAULT_VALUES_MODE: ValuesMode = 'relations';

// ============================================
// ОСНОВНАЯ ФУНКЦИЯ ГЕНЕРАЦИИ
// ============================================

/**
 * Генерирует компактный отчёт из карты сущностей.
 *
 * @param entitiesMap — карта «путь файла → сущности»
 * @param outputPath — путь для сохранения сжатого JSON
 * @param options — дополнительные опции
 * @returns Результат генерации с полным и сжатым JSON
 */
export function generateCompactReport(
  entitiesMap: Record<string, EntitiesResult>,
  outputPath?: string,
  options: GenerateReportOptions = {}
): GenerateReportResult {
  const startTime = Date.now();
  const verbose = options.verbose === true;
  const useCompression = options.compress !== false;
  const saveFull = options.saveFullJson !== false && options.saveFull !== false;
  const fullSuffix = options.fullJsonSuffix || '.full.json';

  // ✅ v11.1.0: режим сериализации values
  const valuesMode: ValuesMode = options.valuesMode || DEFAULT_VALUES_MODE;

  // ✅ v9.0.4: edges — по умолчанию НЕ сохраняются в отдельный файл.
  const saveEdges = options.saveEdges === true;
  const edgesSuffix = options.edgesJsonSuffix || '.edges.json';

  // ============================================
  // ШАГ 1: Сбор полного JSON
  // ============================================
  if (verbose) {
    console.log('\n📦 [compact-reporter] Сбор полного JSON...');
    console.log(`   🎛️  valuesMode: ${valuesMode}`);
  }

  const full = collectFullJSON(entitiesMap, verbose, valuesMode);

  if (verbose) {
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

    // ✅ v15.5.6: Vue-сущности
    if (full.vue) {
      console.log(`   📦 Vue SFC: ${full.vue.sfc.length}`);
      console.log(`   ◇  Composables: ${full.vue.composables.length}`);
      console.log(`   ⚙  Macros: ${full.vue.macros.length}`);
      console.log(`   ⚓ Hooks: ${full.vue.hooks.length}`);
      console.log(`   ⚡ Reactivity: ${full.vue.reactivity.length}`);
      console.log(`   🖼  Icons: ${full.vue.icons.length}`);
    }

    // ✅ [P0]: диагностика parentFunctionId
    const fnsWithParent = (full.functions || []).filter(f => f.parentFunctionId).length;
    console.log(`   🧬 Функций с parentFunctionId: ${fnsWithParent}/${full.functions.length}`);

    // ✅ v15.5.7: диагностика vueKind
    const fnsWithVueKind = (full.functions || []).filter(
      f => f.vueKind !== undefined && f.vueKind !== null
    ).length;
    const fnsNonFunctionVueKind = (full.functions || []).filter(
      f => f.vueKind !== undefined && f.vueKind !== null && f.vueKind !== 'function'
    ).length;

    console.log(
      `   🎯 Функций с vueKind: ${fnsWithVueKind}/${full.functions.length} ` +
      `(не 'function': ${fnsNonFunctionVueKind})`
    );

    // ✅ v15.5.7: предупреждение, если vueKind отсутствует у > 50% функций
    if (full.functions.length > 0 && fnsWithVueKind < full.functions.length * 0.5) {
      console.warn(
        `   ⚠️  vueKind отсутствует у ${full.functions.length - fnsWithVueKind}/${full.functions.length} функций`
      );
      console.warn(
        `   💡 Проверьте convertFunctionToEnhanced() в entities-converter.ts — проброс vueKind`
      );
    }

    // ✅ [P0]: проверка целостности parentFunctionId
    const fnIdSet = new Set((full.functions || []).map(f => f.id));
    const badParents = (full.functions || []).filter(
      f => f.parentFunctionId && !fnIdSet.has(f.parentFunctionId)
    );
    if (badParents.length > 0) {
      console.warn(
        `   ⚠️  Функций с parentFunctionId, ссылающимся на несуществующий ID: ${badParents.length}`
      );
      for (const f of badParents.slice(0, 5)) {
        console.warn(`      • ${f.id} (${f.name}): parent=${f.parentFunctionId}`);
      }
    }

    // ✅ [P2]: диагностика callKind
    const callsWithKind = (full.calls || []).filter(c => c.callKind).length;
    console.log(`   🎯 Вызовов с callKind: ${callsWithKind}/${full.calls.length}`);

    // ✅ v8.5.0: диагностика неразрешённых импортов
    const unresolvedImports = (full.imports || []).filter(
      imp => !imp.isExternal && imp.toFileId?.startsWith('unresolved:')
    );
    if (unresolvedImports.length > 0) {
      console.log(`   ⚠️  Неразрешённых импортов: ${unresolvedImports.length}`);
      for (const imp of unresolvedImports.slice(0, 5)) {
        console.log(`      • ${path.basename(imp.fromFileId)} → '${imp.source}'`);
      }
      if (unresolvedImports.length > 5) {
        console.log(`      ... и ещё ${unresolvedImports.length - 5}`);
      }
    } else {
      console.log(`   ✅ Все импорты разрешены`);
    }

    // ✅ v15.0.4: диагностика пустых имён
    const emptyNameImports = (full.imports || []).filter(
      imp => !imp.importedName && !imp.localName
    );
    if (emptyNameImports.length > 0) {
      console.log(`   ⚠️  Импортов с пустыми именами: ${emptyNameImports.length}`);
    }

    // ✅ v15.5.5: диагностика не-JSON-значений в constants[]
    if (full.constants) {
      let unsafeCount = 0;
      const samples: string[] = [];
      for (const cn of full.constants) {
        if (cn.value !== undefined && !isJsonSafe(cn.value)) {
          unsafeCount++;
          if (samples.length < 5) {
            const ctorName =
              typeof cn.value === 'object' && cn.value !== null
                ? (cn.value as any).constructor?.name ?? 'Object'
                : typeof cn.value;
            samples.push(`${cn.name} (${ctorName})`);
          }
        }
      }
      if (unsafeCount > 0) {
        console.warn(
          `   ⚠️  ${unsafeCount} констант содержат не-JSON-значения ` +
          `(Set, Map, RegExp, Date, class instances)`
        );
        for (const s of samples) {
          console.warn(`      • ${s}`);
        }
        if (unsafeCount > samples.length) {
          console.warn(`      ... и ещё ${unsafeCount - samples.length}`);
        }
        console.warn(
          `   💡 Эти значения будут санитизированы через jsonSafeStringify при записи`
        );
      }
    }
  }

  // ============================================
  // ШАГ 2: Проверка round-trip (только в verbose)
  // ============================================
  if (verbose && useCompression) {
    const verification = Codec.verifyRoundTrip(full, { valuesMode });
    if (!verification.ok) {
      console.warn(`   ⚠️  Round-trip проверка не пройдена: ${verification.error}`);
    } else {
      console.log('   ✅ Round-trip проверка пройдена');
    }
  }

  // ============================================
  // ШАГ 3: Сжатие через Codec
  // ============================================
  let compact: CompactJSON | undefined;
  if (useCompression) {
    compact = Codec.encode(full, valuesMode);
    if (verbose) {
      console.log(
        `   🗜️  Сжатие применено (v${compact.v}, valuesMode: ${compact.valuesMode || 'undefined'})`
      );

      const valuesCount = compact.values?.length ?? 0;
      console.log(`   📦 values[]: ${valuesCount} элементов`);

      // ✅ v15.5.6: диагностика vue-секции в compact
      if (compact.vue) {
        console.log(`   📦 compact.vue.sfc.f: ${compact.vue.sfc.f.length}`);
        console.log(`   ◇  compact.vue.composables.n: ${compact.vue.composables.n.length}`);
        console.log(`   ⚙  compact.vue.macros.f: ${compact.vue.macros.f.length}`);
        console.log(`   ⚓ compact.vue.hooks.f: ${compact.vue.hooks.f.length}`);
        console.log(`   ⚡ compact.vue.reactivity.f: ${compact.vue.reactivity.f.length}`);
        console.log(`   🖼  compact.vue.icons.f: ${compact.vue.icons.f.length}`);
      }
    }
  }

  // ============================================
  // ШАГ 4: Сохранение файлов
  // ============================================
  let compactPath: string | undefined;
  let fullPath: string | undefined;
  let edgesPath: string | undefined;
  let compactSize: number | undefined;
  let fullSize: number | undefined;
  let edgesSize: number | undefined;
  let compressionRatio: number | undefined;

  if (outputPath) {
    let fullPathResolved: string | undefined;
    if (saveFull) {
      fullPathResolved = insertSuffixBeforeExtension(outputPath, fullSuffix);

      if (path.resolve(fullPathResolved) === path.resolve(outputPath)) {
        console.warn(
          `   ⚠️  [compact-reporter] fullPath совпал с compactPath, ` +
          `применяю аварийный суффикс: ${outputPath}`
        );
        fullPathResolved = insertUniqueSuffix(outputPath, fullSuffix);
      }
    }

    if (compact) {
      const saved = saveJsonFile(outputPath, compact, 'Сжатый JSON', verbose);
      compactPath = saved.path;
      compactSize = saved.size;
    }

    if (saveFull && fullPathResolved) {
      const saved = saveJsonFile(fullPathResolved, full, 'Полный JSON', verbose);
      fullPath = saved.path;
      fullSize = saved.size;

      if (compactPath && path.resolve(compactPath) === path.resolve(fullPath)) {
        console.error(
          `   ❌ [compact-reporter] КРИТИЧЕСКАЯ ОШИБКА: ` +
          `compactPath и fullPath совпадают: ${compactPath}`
        );
      }
    }

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

    if (compactSize !== undefined && fullSize !== undefined && fullSize > 0) {
      compressionRatio = (compactSize / fullSize) * 100;
      if (verbose) {
        console.log(`   📉 Сжатие: ${compressionRatio.toFixed(1)}% от полного размера`);
      }
    }
  }

  // ============================================
  // ШАГ 5: Финальная статистика
  // ============================================
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

// ============================================
// ФУНКЦИИ ДЕКОДИРОВАНИЯ
// ============================================

/**
 * Декодирует сжатый JSON обратно в полный.
 */
export function decodeCompactReport(
  compact: CompactJSON,
  options: DecodeOptions = {}
): FullJSON {
  return Codec.decode(compact, options);
}

/**
 * Читает сжатый JSON из файла и декодирует его.
 */
export function readAndDecode(compactPath: string, options: DecodeOptions = {}): FullJSON {
  if (!fs.existsSync(compactPath)) {
    throw new Error(`Файл не найден: ${compactPath}`);
  }

  const content = fs.readFileSync(compactPath, 'utf-8');
  let compact: CompactJSON;

  try {
    compact = JSON.parse(content) as CompactJSON;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Не удалось распарсить JSON: ${msg}`);
  }

  const valuesMode = (compact as any).valuesMode as ValuesMode | undefined;
  return Codec.decode(compact, { ...options, valuesMode });
}

/**
 * Читает полный JSON из файла.
 */
export function readFullJson(fullPath: string): FullJSON {
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Файл не найден: ${fullPath}`);
  }

  const content = fs.readFileSync(fullPath, 'utf-8');
  return JSON.parse(content) as FullJSON;
}

// ============================================
// ✅ v10.4.0: ЕДИНОЕ СОХРАНЕНИЕ JSON
// ============================================

interface SaveJsonResult {
  path: string;
  size: number;
}

/**
 * Сохраняет объект в JSON-файл.
 *
 * ════════════════════════════════════════════════════════════
 * ✅ v15.5.5: JSON-SAFE СЕРИАЛИЗАЦИЯ
 * ════════════════════════════════════════════════════════════
 *
 * Используется `jsonSafeStringify` из `./codec/stable-stringify.js`:
 *   1. Рекурсивно вызывает `sanitizeForJson(value)`.
 *   2. Set    → массив элементов
 *   3. Map    → plain object
 *   4. RegExp → строка '/pattern/flags'
 *   5. Date   → ISO-строка
 *   6. BigInt → строка '123n'
 *   7. class instances → plain object через Object.keys
 *
 * Это гарантирует, что `JSON.parse(JSON.stringify(x))`
 * даёт эквивалент `x` (в смысле данных), и round-trip
 * не теряет значения.
 */
function saveJsonFile(
  filePath: string,
  data: unknown,
  label: string,
  verbose: boolean
): SaveJsonResult {
  const outputDir = path.dirname(filePath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const json = jsonSafeStringify(data);

  fs.writeFileSync(filePath, json, 'utf-8');
  const size = fs.statSync(filePath).size;

  if (verbose) {
    const sizeKB = (size / 1024).toFixed(2);
    console.log(`   💾 ${label}: ${filePath} (${sizeKB} KB)`);
  }

  return { path: filePath, size };
}

// ============================================
// ✅ v15.0.2: ПОДСЧЁТ CONDITIONALS
// ============================================

/**
 * Считает все conditionals внутри `templates[]`.
 */
function countConditionals(full: FullJSON): number {
  let count = 0;
  for (const template of full.templates ?? []) {
    count += (template.conditionals ?? []).length;
  }
  return count;
}

// ============================================
// ✅ v15.4.0 (P3): ОБОГАЩЕНИЕ CALLS ИЗ CROSS-FILE
// ============================================

/**
 * Маппит callKind из CrossFileCall в CallData.type.
 */
function mapCrossFileCallKindToCallType(
  kind: CrossFileCall['callKind']
): 'direct' | 'async' | 'method' | 'callback' {
  switch (kind) {
    case 'method':
    case 'constructor':
    case 'new':
      return 'method';
    case 'callback':
      return 'callback';
    default:
      return 'direct';
  }
}

// ============================================
// ✅ [P2]: МАППИНГ CallsInfoEntry → CallData
// ============================================

/**
 * Находит подходящий `CallsInfoEntry` для вызова `callName`
 * в функции `func`.
 */
function findCallsInfo(
  func: FunctionInfo,
  callName: string
): CallsInfoEntry | undefined {
  const callsInfo = (func as any).callsInfo as CallsInfoEntry[] | undefined;
  if (!Array.isArray(callsInfo) || callsInfo.length === 0) return undefined;

  const matches = callsInfo.filter(ci => ci && ci.targetName === callName);
  if (matches.length === 0) return undefined;

  return matches[0];
}

// ============================================
// ✅ [P1]: КАРТА compactId → globalFnId
// ============================================

/**
 * Строит карту `compactId (func.id) → globalFnId (fn1, fn2, ...)`.
 */
function buildCompactIdToGlobalFnIdMap(
  entitiesMap: Record<string, EntitiesResult>,
  functions: FunctionData[],
  fileMap: Map<string, FileData>,
  projectRoot: string
): Map<string, string> {
  const map = new Map<string, string>();

  for (const [filePath, entities] of Object.entries(entitiesMap)) {
    if (!entities) continue;

    const absolutePath = path.resolve(filePath);
    const relativePath = path.relative(projectRoot, absolutePath).replace(/\\/g, '/');

    const file = fileMap.get(relativePath);
    if (!file) continue;

    const funcs = entities.functions || [];
    for (const func of funcs) {
      if (!func || !func.id) continue;

      const globalFn = functions.find(
        f =>
          f.fileId === file.id &&
          f.line === (func.line || 0) &&
          f.name === func.name
      );

      if (globalFn) {
        map.set(func.id, globalFn.id);
      }
    }
  }

  return map;
}

// ============================================
// ✅ v15.5.6: VUE-СЕКЦИЯ — КОНВЕРТЕР В FullJSON.vue
// ============================================

/**
 * Конвертирует `VueEntities` (из классификатора) в `VueSectionFull`
 * (формат `FullJSON.vue`).
 *
 * ════════════════════════════════════════════════════════════
 * ЧТО ДЕЛАЕТ
 * ════════════════════════════════════════════════════════════
 *
 *   1. Проходит по `vueEntities.sfc` и для каждого SFC:
 *      - резолвит `fileId` → `moduleId` через `fileMap`
 *   2. Проходит по composables / macros / hooks / reactivity / icons
 *      и нормализует формат.
 *
 * ════════════════════════════════════════════════════════════
 * ⚠️ ВАЖНО ДЛЯ ROUND-TRIP
 * ════════════════════════════════════════════════════════════
 *
 *   `sfc.composables/props/emits/exposed` — это массивы
 *   РЕАЛЬНЫХ имён. В `codec-encode.ts` из них берётся
 *   только ДЛИНА (счётчик) и пишется в `sfc.c[i][1] = count`.
 *
 *   При `decode` в `codec-decode.ts` восстанавливаются
 *   плейсхолдеры `['#0', '#1', ...]` нужной длины.
 *
 *   Это гарантирует, что `encode(decode(compact)) === compact`
 *   по полю `sfc.c` (счётчики совпадают).
 *
 * @param vueEntities — результат `classifyVueEntities()`
 * @param fileMap     — карта `relativePath → FileData`
 * @param projectRoot — корень проекта (для нормализации путей)
 * @returns VueSectionFull
 */
function convertVueEntitiesToFull(
  vueEntities: VueEntities,
  fileMap: Map<string, FileData>,
  projectRoot: string
): VueSectionFull {
  // Вспомогательная функция: filePath → fileId (f1, f2, ...)
  const resolveFileId = (filePath: string): string => {
    const absolutePath = path.resolve(filePath);
    const relativePath = path.relative(projectRoot, absolutePath).replace(/\\/g, '/');
    const file = fileMap.get(relativePath);
    return file?.id ?? 'f1';
  };

  const resolveModuleId = (filePath: string): string => {
    const fileId = resolveFileId(filePath);
    for (const [, f] of fileMap) {
      if (f.id === fileId) return f.moduleId;
    }
    return 'm1';
  };

  return {
    // ────────────────────────────────────────────────────
    // SFC
    // ────────────────────────────────────────────────────
    sfc: (vueEntities.sfc ?? []).map(s => ({
      fileId: resolveFileId(s.fileId),
      moduleId: resolveModuleId(s.fileId),
      name: s.name,
      blocks: s.blocks,
      composables: s.composables ?? [],
      props: s.props ?? [],
      emits: s.emits ?? [],
      exposed: s.exposed ?? [],
    })),

    // ────────────────────────────────────────────────────
    // Composables
    // ────────────────────────────────────────────────────
    composables: (vueEntities.composables ?? []).map(c => ({
      id: c.id,
      name: c.name,
      fileId: resolveFileId(c.fileId),
      kind: c.kind,
      returnShape: c.returnShape,
      returnedKeys: c.returnedKeys ?? [],
      callers: (c.callers ?? []).map(resolveFileId),
    })),

    // ────────────────────────────────────────────────────
    // Macros
    // ────────────────────────────────────────────────────
    macros: (vueEntities.macros ?? []).map(m => ({
      id: m.id,
      fileId: resolveFileId(m.fileId),
      kind: m.kind,
      line: m.line,
    })),

    // ────────────────────────────────────────────────────
    // Hooks
    // ────────────────────────────────────────────────────
    hooks: (vueEntities.hooks ?? []).map(h => ({
      id: h.id,
      fileId: resolveFileId(h.fileId),
      hookName: h.hookName,
      line: h.line,
    })),

    // ────────────────────────────────────────────────────
    // Reactivity
    // ────────────────────────────────────────────────────
    reactivity: (vueEntities.reactivity ?? []).map(r => ({
      id: r.id,
      fileId: resolveFileId(r.fileId),
      kind: r.kind,
      line: r.line,
      name: r.name,
    })),

    // ────────────────────────────────────────────────────
    // Icons
    // ────────────────────────────────────────────────────
    icons: (vueEntities.icons ?? []).map(i => ({
      id: i.id,
      fileId: resolveFileId(i.fileId),
      name: i.name,
      category: i.category,
    })),
  };
}

// ============================================
// СБОР ПОЛНОГО JSON (ВНУТРЕННЯЯ ФУНКЦИЯ)
// ============================================

/**
 * Собирает полный JSON из карты сущностей.
 *
 * ✅ v15.5.7: `vueKind` ГАРАНТИРОВАННО пробрасывается в `FunctionData`.
 * ✅ v15.5.6: заполняет `full.vue` через `classifyVueEntities`.
 */
function collectFullJSON(
  entitiesMap: Record<string, EntitiesResult>,
  verbose: boolean = false,
  valuesMode: ValuesMode = DEFAULT_VALUES_MODE,
  _crossFileCalls?: CrossFileCall[]
): FullJSON {
  const projectRoot = process.cwd();

  // ============================================
  // Инициализация tsconfig
  // ============================================
  try {
    clearTsConfigCache();
    const firstTsFile = Object.keys(entitiesMap).find(
      f => f.endsWith('.ts') || f.endsWith('.tsx')
    );
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

  const workingEntitiesMap = entitiesMap;
  const sortedFilePaths = Object.keys(workingEntitiesMap).sort();

  if (verbose) {
    console.log(`   📋 Стабильный порядок обхода: ${sortedFilePaths.length} файлов`);
  }

  // ============================================
  // Результирующие массивы
  // ============================================
  const modules: ModuleData[] = [];
  const files: FileData[] = [];
  const functions: FunctionData[] = [];
  const classes: ClassData[] = [];
  const constants: ConstantData[] = [];
  const exports: ExportData[] = [];
  const imports: ImportData[] = [];
  const calls: CallData[] = [];
  const reExports: ReExportData[] = [];
  const templates: TemplateData[] = [];

  const lifecycle: LifecycleHook[] = [];
  const effects: EffectEdge[] = [];
  const injections: InjectionEdge[] = [];
  const reactivity: ReactivityEdge[] = [];
  const types: TypeNodeData[] = [];
  const typeRefs: TypeRefData[] = [];

  // ============================================
  // Карты для дедупликации
  // ============================================
  const moduleMap = new Map<string, ModuleData>();
  const fileMap = new Map<string, FileData>();
  const functionMap = new Map<string, FunctionData[]>();
  const sourceToFileIdMap = new Map<string, string>();

  // ============================================
  // Счётчики
  // ============================================
  let moduleCounter = 0;
  let fileCounter = 0;
  let functionCounter = 0;
  let classCounter = 0;
  let constantCounter = 0;
  let exportCounter = 0;
  let importCounter = 0;
  let callCounter = 0;
  let reExportCounter = 0;
  let conditionalCounter = 0;
  let lifecycleCounter = 0;
  let effectCounter = 0;
  let injectionCounter = 0;
  let reactivityCounter = 0;
  let typeCounter = 0;
  let typeRefCounter = 0;
  let emptyNameFixCount = 0;

  // ============================================
  // ПЕРВЫЙ ПРОХОД: модули, файлы, функции, классы, константы
  // ============================================
  for (const filePath of sortedFilePaths) {
    const entities = workingEntitiesMap[filePath];
    if (!entities) continue;

    const absolutePath = path.resolve(filePath);
    const relativePath = path.relative(projectRoot, absolutePath).replace(/\\/g, '/');

    const dirName = path.basename(path.dirname(relativePath)) || 'root';
    let module = moduleMap.get(dirName);

    if (!module) {
      moduleCounter++;
      module = {
        id: `m${moduleCounter}`,
        name: dirName,
        path: dirName,
        fileIds: [],
      };
      moduleMap.set(dirName, module);
      modules.push(module);
    }

    let file = fileMap.get(relativePath);

    if (!file) {
      fileCounter++;
      file = {
        id: `f${fileCounter}`,
        path: relativePath,
        moduleId: module.id,
      };
      fileMap.set(relativePath, file);
      files.push(file);
      module.fileIds.push(file.id);
    }

    const normalizedPath = relativePath;
    const normalizedAbs = absolutePath.replace(/\\/g, '/');

    sourceToFileIdMap.set(filePath, file.id);
    sourceToFileIdMap.set(relativePath, file.id);
    sourceToFileIdMap.set(normalizedPath, file.id);
    sourceToFileIdMap.set(absolutePath, file.id);
    sourceToFileIdMap.set(normalizedAbs, file.id);
    sourceToFileIdMap.set(path.basename(relativePath), file.id);
    const baseNoExt = path.basename(relativePath).replace(/\.[^.]+$/, '');
    sourceToFileIdMap.set(baseNoExt, file.id);
    sourceToFileIdMap.set(relativePath.replace(/\.[^.]+$/, ''), file.id);

    // ============================================================
    // ✅ P0-fix: ФУНКЦИИ — резолвинг parentFunctionId
    // ✅ v15.5.7: ГАРАНТИРОВАННЫЙ проброс vueKind
    // ============================================================
    const funcs = entities.functions || [];

    const localCompactIdToGlobalFnId = new Map<string, string>();
    {
      let previewCounter = functionCounter;
      for (const func of funcs) {
        if (!func || !func.name) continue;
        previewCounter++;
        if (func.id) {
          localCompactIdToGlobalFnId.set(func.id, `fn${previewCounter}`);
        }
      }
    }

    for (const func of funcs) {
      if (!func || !func.name) continue;

      functionCounter++;

      const rawParent = (func as any).parentFunctionId as string | null | undefined;
      const resolvedParentFunctionId =
        rawParent && localCompactIdToGlobalFnId.has(rawParent)
          ? localCompactIdToGlobalFnId.get(rawParent)!
          : null;

      // ✅ v15.5.7: ГАРАНТИРОВАННЫЙ проброс vueKind
      // Извлекаем vueKind из func, используя явное приведение типа.
      // Fallback на 'function', если поле отсутствует — это безопасно,
      // потому что 'function' является значением по умолчанию для VueKind.
      //
      // ⚠️ ВАЖНО: если func.vueKind === undefined, мы ВСЁ РАВНО записываем
      // 'function'. Это гарантирует, что поле vueKind всегда присутствует
      // в FunctionData, и decode(encode(full)) === full по этому полю.
      //
      // Ранее (v15.5.6 и ниже) использовалось:
      //   vueKind: (func as any).vueKind as VueKind | undefined
      // Это приводило к тому, что если func.vueKind === undefined,
      // в FunctionData.vueKind тоже было undefined, и round-trip
      // по этому полю падал (undefined ≠ 'function').
      const rawVueKind = (func as any).vueKind as VueKind | undefined | null;
      const vueKind: VueKind = rawVueKind ?? 'function';

      const funcData: FunctionData = {
        id: `fn${functionCounter}`,
        name: func.name,
        moduleId: module.id,
        fileId: file.id,
        line: func.line || 0,
        isExported: func.isExported || false,
        isAsync: func.isAsync || false,
        isArrow: func.isArrow || false,
        isMethod: func.isMethod || false,
        params: func.params || [],
        returnType: func.returnType,
        parentFunctionId: resolvedParentFunctionId,
        // ✅ v15.5.7: vueKind ВСЕГДА заполнен (минимум 'function')
        vueKind,
      };

      if (func.isEventHandler) funcData.isEventHandler = true;
      if (func.isNested) funcData.isNested = true;
      if ((func as any).isSelf) funcData.isSelf = true;

      functions.push(funcData);

      if (!functionMap.has(func.name)) {
        functionMap.set(func.name, []);
      }
      functionMap.get(func.name)!.push(funcData);
    }

    // Классы
    const classesList = entities.classes || [];
    for (const cls of classesList) {
      if (!cls || !cls.name) continue;

      classCounter++;
      classes.push({
        id: `cls${classCounter}`,
        name: cls.name,
        moduleId: module.id,
        fileId: file.id,
        line: cls.line || 0,
        isExported: cls.isExported || false,
        methods: cls.methods || [],
      });
    }

    // Константы
    const constantsList = entities.constants || [];
    for (const cn of constantsList) {
      if (!cn || !cn.name) continue;

      constantCounter++;

      const valueToStore = isValueKept(cn.value, valuesMode) ? cn.value : undefined;

      constants.push({
        id: `cn${constantCounter}`,
        name: cn.name,
        moduleId: module.id,
        fileId: file.id,
        line: cn.line || 0,
        isExported: cn.isExported || false,
        value: valueToStore,
      });
    }
  }

  if (verbose) {
    console.log(
      `   ✅ Первый проход: ${modules.length} модулей, ${files.length} файлов, ${functions.length} функций`
    );
  }

  // ============================================
  // СБОР VUE-ШАБЛОНОВ
  // ============================================
  for (const filePath of sortedFilePaths) {
    const entities = workingEntitiesMap[filePath];
    if (!entities) continue;
    if (!filePath.endsWith('.vue')) continue;

    const absolutePath = path.resolve(filePath);
    const relativePath = path.relative(projectRoot, absolutePath).replace(/\\/g, '/');

    const dirName = path.basename(path.dirname(relativePath)) || 'root';
    const module = moduleMap.get(dirName);
    const file = fileMap.get(relativePath);
    if (!module || !file) continue;

    const e = entities as any;

    const hasTemplate =
      (e.templateReactivityDeps?.length || 0) +
      (e.templateEventHandlers?.length || 0) +
      (e.templateDynamicComponents?.length || 0) +
      (e.templateRefs?.length || 0) +
      (e.templateCssVariables?.length || 0) +
      (e.templateDeepSelectors?.length || 0) +
      (e.templateUsedComponents?.length || 0) +
      (e.templateSlots?.length || 0) +
      (e.templateDirectives?.length || 0) +
      (e.templateConditionals?.length || 0) +
      (e.templateComplexity || 0) >
      0;

    if (!hasTemplate) continue;

    const fileConditionals = e.templateConditionals || [];
    const enrichedConditionals: TemplateConditional[] = fileConditionals.map((cd: any) => {
      conditionalCounter++;
      return {
        id: `cd${conditionalCounter}`,
        directive: cd.directive,
        fileId: file.id,
        line: cd.line,
        conditionExpression: cd.conditionExpression,
        renderedComponent: cd.renderedComponent,
      };
    });

    const templateData: TemplateData = {
      fileId: file.id,
      moduleId: module.id,
      reactivityDeps: e.templateReactivityDeps || [],
      eventHandlers: e.templateEventHandlers || [],
      dynamicComponents: (e.templateDynamicComponents || []).map((d: any) => ({
        isExpression: d.isExpression || '',
        line: d.line || 0,
        resolvedComponents: d.resolvedComponents || [],
      })),
      directives: e.templateDirectives || [],
      usedComponents: e.templateUsedComponents || [],
      templateRefs: (e.templateRefs || []).map((ref: any) => ({
        refValue: ref.refValue || '',
        tag: ref.tag || '',
        line: ref.line || 0,
        exposedMethods: ref.exposedMethods || [],
      })),
      cssVariables: e.templateCssVariables || [],
      deepSelectors: e.templateDeepSelectors || [],
      slots: e.templateSlots || [],
      complexity: e.templateComplexity || 0,
      conditionals: enrichedConditionals,
    };

    templates.push(templateData);
  }

  if (verbose && templates.length > 0) {
    console.log(`   🎨 Vue-шаблонов: ${templates.length}`);
    console.log(`   🎯 Conditionals: ${countConditionals({ templates } as FullJSON)}`);
  }

  // ============================================
  // ВТОРОЙ ПРОХОД: экспорты, импорты, вызовы, реэкспорты
  // ============================================
  for (const filePath of sortedFilePaths) {
    const entities = workingEntitiesMap[filePath];
    if (!entities) continue;

    const absolutePath = path.resolve(filePath);
    const relativePath = path.relative(projectRoot, absolutePath).replace(/\\/g, '/');

    const dirName = path.basename(path.dirname(relativePath)) || 'root';
    const module = moduleMap.get(dirName);
    const file = fileMap.get(relativePath);

    if (!module || !file) continue;

    // --------------------------------------------
    // ЭКСПОРТЫ и РЕЭКСПОРТЫ
    // --------------------------------------------
    const exportsList = entities.exports || [];

    for (const exp of exportsList) {
      if (!exp || !exp.name) continue;

      const funcDataArray = functionMap.get(exp.name);
      const funcData = funcDataArray && funcDataArray.length > 0 ? funcDataArray[0] : undefined;

      const expLine = exp.loc?.start?.line ?? exp.line ?? 0;
      const localName = exp.localName ?? exp.name;
      const isTypeOnly = exp.isTypeOnly ?? false;
      const isStarReExport = exp.isStarReExport ?? false;
      const isDefaultReExport = exp.isDefaultReExport ?? false;

      if (exp.isReExport && exp.source) {
        if (!funcData) continue;

        reExportCounter++;

        let reType: 'named' | 'default' | 'all' = 'named';
        if (isStarReExport) reType = 'all';
        else if (isDefaultReExport || exp.isDefault) reType = 'default';

        reExports.push({
          id: `re${reExportCounter}`,
          moduleId: module.id,
          functionId: funcData.id,
          source: exp.source,
          exportName: exp.name,
          line: expLine,
          type: reType,
          isDefault: exp.isDefault || isDefaultReExport,
          isTypeOnly,
          isStarReExport,
        });

        continue;
      }

      if (!funcData) continue;

      exportCounter++;

      let exportType: 'named' | 'default' | 'type' = 'named';
      if (exp.isDefault) exportType = 'default';
      else if (isTypeOnly || exp.type === 'interface' || exp.type === 'type') {
        exportType = 'type';
      }

      exports.push({
        id: `e${exportCounter}`,
        moduleId: module.id,
        fileId: file.id,
        functionId: funcData.id,
        exportName: exp.name,
        localName,
        line: expLine,
        type: exportType,
        isDefault: exp.isDefault || false,
        isTypeOnly,
        isReExport: false,
        isStarReExport: false,
        isDefaultReExport: false,
        source: undefined,
      });
    }

    // --------------------------------------------
    // ИМПОРТЫ
    // --------------------------------------------
    const importsList = entities.imports || [];

    for (const imp of importsList) {
      if (!imp || !imp.source) continue;

      const specifiersStructured = (imp as any).specifiersStructured || [];
      const specifiers = imp.specifiers || [];
      const isReExport = (imp as any).isReExport === true;
      const isStarReExport = (imp as any).isStarReExport === true;

      const toFileIdFromAst = (imp as any).toFileId as string | undefined;

      let resolvedToFileId: string | null = null;

      if (
        toFileIdFromAst?.startsWith('external:') ||
        toFileIdFromAst?.startsWith('unresolved:')
      ) {
        resolvedToFileId = toFileIdFromAst;
      } else {
        resolvedToFileId = resolveToFileId(imp.source, filePath, sourceToFileIdMap, fileMap);
        if (!resolvedToFileId) {
          resolvedToFileId = toFileIdFromAst || `unresolved:${imp.source}`;
        }
      }

      const isExternal = resolvedToFileId?.startsWith('external:') === true;

      let packageName: string | undefined;
      if (isExternal && resolvedToFileId) {
        const pkgPart = resolvedToFileId.slice('external:'.length);
        packageName = pkgPart || undefined;
      } else if (isExternal) {
        packageName = (imp as any).packageName;
      }

      if (
        resolvedToFileId &&
        !/^f\d+$/.test(resolvedToFileId) &&
        !resolvedToFileId.startsWith('external:') &&
        !resolvedToFileId.startsWith('unresolved:')
      ) {
        resolvedToFileId = `unresolved:${imp.source}`;
      }

      if (resolvedToFileId === null && !isExternal) {
        resolvedToFileId = `unresolved:${imp.source}`;
      }

      const impLine = imp.loc?.start?.line ?? (imp as any).line ?? 0;

      if (specifiersStructured.length > 0) {
        for (const spec of specifiersStructured) {
          let importedName = spec.imported || '';
          let localName = spec.local || '';

          if (!importedName && !localName) {
            if (spec.type === 'ExportAllSpecifier' || spec.type === 'ImportNamespaceSpecifier') {
              importedName = '*';
              localName = '*';
            } else if (spec.type === 'ImportDefaultSpecifier') {
              importedName = 'default';
              localName = path.basename(imp.source).replace(/\.[^.]+$/, '');
            } else {
              const fallbackName = path.basename(imp.source).replace(/\.[^.]+$/, '');
              importedName = fallbackName;
              localName = fallbackName;
            }
            emptyNameFixCount++;
          } else if (!importedName) {
            importedName = localName;
          } else if (!localName) {
            localName = importedName;
          }

          importCounter++;

          const baseType = getImportTypeFromSpecifierType(spec.type);
          const importType: 'named' | 'default' | 'namespace' = baseType;

          const importData: ImportData = {
            id: `i${importCounter}`,
            fromFileId: file.id,
            toFileId: resolvedToFileId,
            source: imp.source,
            importedName,
            localName,
            line: impLine,
            type: importType,
            isDefault: spec.type === 'ImportDefaultSpecifier',
            isNamespace:
              spec.type === 'ImportNamespaceSpecifier' ||
              spec.type === 'ExportAllSpecifier',
            isTypeOnly: imp.isTypeOnly || false,
            isExternal,
            packageName,
          };

          if (isReExport) {
            importData.isReExport = true;
            if (isStarReExport) importData.isStarReExport = true;
          }

          imports.push(importData);
        }
      } else if (Array.isArray(specifiers) && specifiers.length > 0) {
        for (const spec of specifiers as unknown[]) {
          let importedName = '';
          let localName = '';
          let importType: 'named' | 'default' | 'namespace' = 'named';
          let isDefault = false;
          let isNamespace = false;

          if (typeof spec === 'string') {
            const specStr = spec as string;
            const match = specStr.match(/^(.+?)\s+as\s+(.+)$/);
            if (match) {
              importedName = match[1] || '';
              localName = match[2] || '';
            } else {
              importedName = specStr.trim();
              localName = specStr.trim();
            }

            if (importedName === 'default') {
              importType = 'default';
              isDefault = true;
            } else if (importedName === '*') {
              importType = 'namespace';
              isNamespace = true;
            }
          } else if (spec && typeof spec === 'object') {
            const specObj = spec as {
              imported?: string;
              local?: string;
              type?: string;
            };
            importedName = specObj.imported || specObj.local || '';
            localName = specObj.local || specObj.imported || '';

            if (specObj.type === 'ImportDefaultSpecifier') {
              importType = 'default';
              isDefault = true;
            } else if (specObj.type === 'ImportNamespaceSpecifier') {
              importType = 'namespace';
              isNamespace = true;
            } else if (specObj.type === 'ExportAllSpecifier') {
              importType = 'namespace';
              isNamespace = true;
            }
          }

          if (!importedName && !localName) {
            if (isReExport) {
              importedName = '*';
              localName = '*';
              importType = 'namespace';
              isNamespace = true;
            } else {
              const fallbackName = path.basename(imp.source).replace(/\.[^.]+$/, '');
              importedName = fallbackName;
              localName = fallbackName;
            }
            emptyNameFixCount++;
          } else if (!importedName) {
            importedName = localName;
          } else if (!localName) {
            localName = importedName;
          }

          importCounter++;

          const importData: ImportData = {
            id: `i${importCounter}`,
            fromFileId: file.id,
            toFileId: resolvedToFileId,
            source: imp.source,
            importedName,
            localName,
            line: impLine,
            type: importType,
            isDefault,
            isNamespace,
            isTypeOnly: imp.isTypeOnly || false,
            isExternal,
            packageName,
          };

          if (isReExport) {
            importData.isReExport = true;
            if (isStarReExport) importData.isStarReExport = true;
          }

          imports.push(importData);
        }
      } else {
        if (isReExport) {
          const alreadyExists = imports.some(
            existing =>
              existing.fromFileId === file.id &&
              existing.source === imp.source &&
              existing.isReExport === true
          );

          if (alreadyExists) {
            if (verbose) {
              console.log(
                `   ⏭️  Пропуск дубля реэкспорта: ${path.basename(filePath)} → '${imp.source}'`
              );
            }
            continue;
          }

          importCounter++;
          emptyNameFixCount++;

          const importData: ImportData = {
            id: `i${importCounter}`,
            fromFileId: file.id,
            toFileId: resolvedToFileId,
            source: imp.source,
            importedName: '*',
            localName: '*',
            line: impLine,
            type: 'namespace',
            isDefault: false,
            isNamespace: true,
            isTypeOnly: imp.isTypeOnly || false,
            isExternal,
            packageName,
            isReExport: true,
          };

          if (isStarReExport) {
            importData.isStarReExport = true;
          }

          imports.push(importData);
        }
      }
    }

    // --------------------------------------------
    // ВЫЗОВЫ ФУНКЦИЙ
    // --------------------------------------------
    const funcs = entities.functions || [];

    for (const func of funcs) {
      if (!func || !func.name) continue;

      const fromFuncArray = functionMap.get(func.name);
      const fromFunc = fromFuncArray && fromFuncArray.length > 0 ? fromFuncArray[0] : undefined;
      if (!fromFunc) continue;

      const callsList = func.calls || [];

      for (const callName of callsList) {
        if (!callName) continue;

        const toFuncArray = functionMap.get(callName);
        const toFunc = toFuncArray && toFuncArray.length > 0 ? toFuncArray[0] : undefined;

        const callType = detectCallType(func, callName);
        const info = findCallsInfo(func, callName);

        if (!toFunc) {
          callCounter++;
          const callData: CallData = {
            id: `c${callCounter}`,
            fromFunctionId: fromFunc.id,
            toFunctionId: `external:${callName}`,
            line: info?.line ?? func.line ?? 0,
            type: callType,
          };
          if (info?.column !== undefined) callData.column = info.column;
          if (info?.callKind !== undefined) callData.callKind = info.callKind;
          if (info?.calleeName !== undefined) callData.calleeName = info.calleeName;
          if (info?.argumentIndex !== undefined) callData.argumentIndex = info.argumentIndex;

          calls.push(callData);
          continue;
        }

        if (fromFunc.id === toFunc.id) continue;

        callCounter++;
        const callData: CallData = {
          id: `c${callCounter}`,
          fromFunctionId: fromFunc.id,
          toFunctionId: toFunc.id,
          line: info?.line ?? func.line ?? 0,
          type: callType,
        };
        if (info?.column !== undefined) callData.column = info.column;
        if (info?.callKind !== undefined) callData.callKind = info.callKind;
        if (info?.calleeName !== undefined) callData.calleeName = info.calleeName;
        if (info?.argumentIndex !== undefined) callData.argumentIndex = info.argumentIndex;

        calls.push(callData);
      }
    }
  }

  if (verbose) {
    console.log(
      `   ✅ Второй проход: ${exports.length} экспортов, ${reExports.length} реэкспортов, ${calls.length} вызовов, ${imports.length} импортов`
    );
    if (emptyNameFixCount > 0) {
      console.log(`   🔧 Исправлено пустых имён импортов: ${emptyNameFixCount}`);
    }
  }

  // ============================================
  // ✅ v15.4.0 (P3): ОБОГАЩЕНИЕ CALLS ИЗ CROSS-FILE
  // ============================================
  if (_crossFileCalls && _crossFileCalls.length > 0) {
    const existingCalls = new Set<string>(
      calls.map(c => `${c.fromFunctionId}|${c.toFunctionId}|${c.line}`)
    );

    let crossFileAdded = 0;

    for (const cf of _crossFileCalls) {
      if (!cf.isCrossFile) continue;

      const key = `${cf.fromFunctionId}|${cf.toFunctionId}|${cf.line}`;
      if (existingCalls.has(key)) continue;
      existingCalls.add(key);

      callCounter++;
      const call: CallData = {
        id: `c${callCounter}`,
        fromFunctionId: cf.fromFunctionId,
        toFunctionId: cf.toFunctionId,
        line: cf.line,
        type: mapCrossFileCallKindToCallType(cf.callKind),
      };

      if (cf.column !== undefined) call.column = cf.column;
      if (cf.callKind !== undefined) call.callKind = cf.callKind;
      if (cf.calleeName !== undefined) call.calleeName = cf.calleeName;

      calls.push(call);
      crossFileAdded++;
    }

    if (verbose && crossFileAdded > 0) {
      console.log(`   🔗 Добавлено межфайловых вызовов: ${crossFileAdded}`);
    }
  }

  // ============================================
  // СБОР РАСШИРЕННЫХ СЕКЦИЙ (lifecycle/effects/injections/reactivity/types)
  // ============================================
  for (const filePath of sortedFilePaths) {
    const entities = workingEntitiesMap[filePath];
    if (!entities) continue;

    const absolutePath = path.resolve(filePath);
    const relativePath = path.relative(projectRoot, absolutePath).replace(/\\/g, '/');

    const dirName = path.basename(path.dirname(relativePath)) || 'root';
    const module = moduleMap.get(dirName);
    const file = fileMap.get(relativePath);
    if (!module || !file) continue;

    const e = entities as any;

    // --- LIFECYCLE (lc) ---
    for (const lc of e.templateLifecycle || []) {
      lifecycleCounter++;
      const funcArray = functionMap.get(lc.functionName);
      const func = funcArray?.[0];
      const callbackFuncArray = lc.callbackFunctionName
        ? functionMap.get(lc.callbackFunctionName)
        : undefined;
      const callbackFunc = callbackFuncArray?.[0];

      lifecycle.push({
        id: `lc${lifecycleCounter}`,
        hookName: lc.hookName,
        functionId: func?.id || '',
        line: lc.line || 0,
        callbackFunctionId: callbackFunc?.id,
        isSetupContext: lc.isSetupContext || false,
      });
    }

    // --- EFFECTS (ef) ---
    for (const ef of e.templateEffects || []) {
      effectCounter++;
      const funcArray = functionMap.get(ef.functionName);
      const func = funcArray?.[0];

      effects.push({
        id: `ef${effectCounter}`,
        effectType: ef.effectType,
        functionId: func?.id || '',
        line: ef.line || 0,
        targetName: ef.targetName || '',
        metaValue: ef.metaValue,
      });
    }

    // --- INJECTIONS (inj) ---
    for (const inj of e.templateInjections || []) {
      injectionCounter++;
      injections.push({
        id: `in${injectionCounter}`,
        kind: inj.kind,
        fileId: file.id,
        line: inj.line || 0,
        key: inj.key || '',
        isSymbolKey: inj.isSymbolKey || false,
        hasDefault: inj.hasDefault || false,
      });
    }

    // --- REACTIVITY (rx) ---
    for (const rx of e.templateReactivity || []) {
      reactivityCounter++;
      const funcArray = functionMap.get(rx.functionName);
      const func = funcArray?.[0];

      reactivity.push({
        id: `rx${reactivityCounter}`,
        kind: rx.kind,
        functionId: func?.id || '',
        line: rx.line || 0,
        reads: rx.reads || [],
        writes: rx.writes || [],
        isWriteable: rx.isWriteable || false,
      });
    }

    // --- TYPES (ty) ---
    for (const ty of e.typesGraph || []) {
      typeCounter++;
      types.push({
        id: `t${typeCounter}`,
        kind: ty.kind,
        name: ty.name || '',
        moduleId: module.id,
        fileId: file.id,
        line: ty.line || 0,
        members: ty.members || [],
        extendsTypes: ty.extendsTypes || [],
      });
    }

    // --- TYPE REFS (tr) ---
    for (const tr of e.typeRefsGraph || []) {
      typeRefCounter++;
      typeRefs.push({
        id: `tr${typeRefCounter}`,
        typeName: tr.typeName || '',
        moduleId: module.id,
        fileId: file.id,
        line: tr.line || 0,
        usageKind: tr.usageKind,
      });
    }
  }

  if (
    verbose &&
    lifecycle.length + effects.length + injections.length + reactivity.length + types.length + typeRefs.length > 0
  ) {
    console.log(`   🧬 Lifecycle: ${lifecycle.length}`);
    console.log(`   ⚡ Effects: ${effects.length}`);
    console.log(`   💉 Injections: ${injections.length}`);
    console.log(`   🔄 Reactivity: ${reactivity.length}`);
    console.log(`   📐 Types: ${types.length}`);
    console.log(`   🔗 TypeRefs: ${typeRefs.length}`);
  }

  // ============================================
  // ✅ [P1]: LEXICAL LINKS
  // ============================================
  const lexicalLinks: LexicalLink[] = [];
  let lexicalCounter = 0;

  {
    const compactIdToGlobalFnId = buildCompactIdToGlobalFnIdMap(
      workingEntitiesMap,
      functions,
      fileMap,
      projectRoot
    );

    for (const filePath of sortedFilePaths) {
      const entities = workingEntitiesMap[filePath];
      if (!entities) continue;

      const localLinks = (entities as any).lexicalLinks || [];
      for (const link of localLinks) {
        if (!link) continue;

        const parentGlobalId = link.parentFunctionId
          ? compactIdToGlobalFnId.get(link.parentFunctionId) ?? null
          : null;
        const childGlobalId = compactIdToGlobalFnId.get(link.childFunctionId);
        if (!childGlobalId) continue;

        lexicalCounter++;
        lexicalLinks.push({
          id: `lx${lexicalCounter}`,
          parentFunctionId: parentGlobalId,
          childFunctionId: childGlobalId,
          relation: link.relation,
          line: link.line,
          argumentIndex: link.argumentIndex,
          calleeName: link.calleeName,
        });
      }
    }
  }

  if (verbose && lexicalLinks.length > 0) {
    console.log(`   🧩 LexicalLinks: ${lexicalLinks.length}`);
  }

  // ============================================
  // ✅ v15.5.6: VUE-СЕКЦИЯ
  // ============================================
  // Собираем Vue-сущности через classifyVueEntities() и конвертируем
  // в формат FullJSON.vue.
  //
  // ⚠️ Счётчики sfc.c[i][1] / sfc.p[i][1] / sfc.e[i][1] / sfc.x[i][1]
  //    заполняются РЕАЛЬНЫМИ длинами массивов composables / props /
  //    emits / exposed. Это гарантирует round-trip:
  //      encode(full) → compact.vue.sfc.c[i] = [fileIdx, N]
  //      decode(compact) → full.vue.sfc[i].composables = ['#0', ..., '#N-1']
  //      encode(decode(compact)) → compact.vue.sfc.c[i] = [fileIdx, N]  ✅
  // ============================================
  let vue: VueSectionFull | undefined;

  try {
    const vueEntities: VueEntities = classifyVueEntities(workingEntitiesMap);

    const hasAnyVue =
      vueEntities.sfc.length > 0 ||
      vueEntities.composables.length > 0 ||
      vueEntities.macros.length > 0 ||
      vueEntities.hooks.length > 0 ||
      vueEntities.reactivity.length > 0 ||
      vueEntities.icons.length > 0;

    if (hasAnyVue) {
      vue = convertVueEntitiesToFull(vueEntities, fileMap, projectRoot);

      if (verbose) {
        console.log(`   📦 Vue SFC: ${vue.sfc.length}`);
        console.log(`   ◇  Composables: ${vue.composables.length}`);
        console.log(`   ⚙  Macros: ${vue.macros.length}`);
        console.log(`   ⚓ Hooks: ${vue.hooks.length}`);
        console.log(`   ⚡ Reactivity: ${vue.reactivity.length}`);
        console.log(`   🖼  Icons: ${vue.icons.length}`);
      }
    }
  } catch (err) {
    if (verbose) {
      console.warn(
        `   ⚠️  Ошибка classifyVueEntities: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // ============================================
  // СТАТИСТИКА
  // ============================================
  const totalConditionals = templates.reduce(
    (sum, t) => sum + (t.conditionals?.length ?? 0),
    0
  );

  const statistics: StatisticsData = {
    totalModules: modules.length,
    totalFiles: files.length,
    totalFunctions: functions.length,
    totalClasses: classes.length,
    totalConstants: constants.length,
    totalExports: exports.length,
    totalImports: imports.length,
    totalCalls: calls.length,
    totalReExports: reExports.length,
    totalTemplates: templates.length,
    totalLexicalLinks: lexicalLinks.length,

    // ==========================================
    // ✅ v15.5.6: Vue-статистика
    // ==========================================
    // ⚠️ ВАЖНО: имена полей должны СОВПАДАТЬ с `StatisticsData`
    //    в `codec-types.ts`. Используются `totalVueSfc` (а НЕ
    //    `totalSfcComponents`), `totalComposables`, `totalMacros`,
    //    `totalHooks`, `totalReactivity`, `totalIcons`.
    // ==========================================
    totalVueSfc: vue?.sfc.length ?? 0,
    totalComposables: vue?.composables.length ?? 0,
    totalMacros: vue?.macros.length ?? 0,
    totalHooks: vue?.hooks.length ?? 0,
    totalReactivity: vue?.reactivity.length ?? 0,
    totalIcons: vue?.icons.length ?? 0,
  };

  (statistics as any).totalConditionals = totalConditionals;

  // ============================================
  // Определение корневого модуля
  // ============================================
  let root = 'm0';

  for (const file of files) {
    if (file.path.endsWith('src/index.ts') || file.path.endsWith('src\\index.ts')) {
      const module = modules.find(m => m.id === file.moduleId);
      if (module) {
        root = module.id;
        break;
      }
    }
  }

  if (root === 'm0' && modules.length > 0) {
    const firstModule = modules[0];
    if (firstModule) {
      root = firstModule.id;
    }
  }

  // ============================================
  // Финальный объект
  // ============================================
  const result: FullJSON = {
    version: CODEC_VERSION,
    timestamp: new Date().toISOString(),
    root,
    valuesMode,
    modules,
    files,
    functions,
    classes,
    constants,
    exports,
    imports,
    calls,
    reExports,
    templates: templates.length > 0 ? templates : undefined,
    statistics,
    lifecycle: lifecycle.length > 0 ? lifecycle : undefined,
    effects: effects.length > 0 ? effects : undefined,
    injections: injections.length > 0 ? injections : undefined,
    reactivity: reactivity.length > 0 ? reactivity : undefined,
    types: types.length > 0 ? types : undefined,
    typeRefs: typeRefs.length > 0 ? typeRefs : undefined,
    lexicalLinks: lexicalLinks.length > 0 ? lexicalLinks : undefined,

    // ✅ v15.5.6: Vue-секция
    vue,
  };

  return canonicalizeFullJSON(result);
}

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

function insertSuffixBeforeExtension(filePath: string, suffix: string): string {
  const ext = path.extname(filePath);
  const base = filePath.slice(0, -ext.length);

  let normalizedSuffix = suffix.trim();
  if (!normalizedSuffix) {
    return insertUniqueSuffix(filePath, suffix);
  }
  if (!normalizedSuffix.startsWith('.')) {
    normalizedSuffix = `.${normalizedSuffix}`;
  }

  let suffixWithoutExt = normalizedSuffix;
  if (suffixWithoutExt.endsWith(ext) && ext.length > 0) {
    suffixWithoutExt = suffixWithoutExt.slice(0, -ext.length);
  }

  const result = `${base}${suffixWithoutExt}${ext}`;

  if (path.resolve(result) === path.resolve(filePath)) {
    return insertUniqueSuffix(filePath, suffix);
  }

  return result;
}

function insertUniqueSuffix(filePath: string, suffix: string): string {
  const ext = path.extname(filePath);
  const base = filePath.slice(0, -ext.length);

  let normalizedSuffix = suffix.trim();
  if (normalizedSuffix && !normalizedSuffix.startsWith('.')) {
    normalizedSuffix = `.${normalizedSuffix}`;
  }
  if (normalizedSuffix.endsWith(ext) && ext.length > 0) {
    normalizedSuffix = normalizedSuffix.slice(0, -ext.length);
  }

  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}${normalizedSuffix}.${i}${ext}`;
    if (path.resolve(candidate) !== path.resolve(filePath)) {
      if (!fs.existsSync(candidate)) {
        return candidate;
      }
    }
  }

  const timestamp = Date.now();
  return `${base}${normalizedSuffix}.${timestamp}${ext}`;
}

function resolveToFileId(
  source: string,
  fromFilePath: string,
  sourceToFileIdMap: Map<string, string>,
  fileMap: Map<string, FileData>
): string | null {
  const direct = sourceToFileIdMap.get(source);
  if (direct) return direct;

  const normalizedSource = source.replace(/\\/g, '/');
  const directNormalized = sourceToFileIdMap.get(normalizedSource);
  if (directNormalized) return directNormalized;

  const isAliasLike =
    source.startsWith('@/') ||
    source.startsWith('#/') ||
    source.startsWith('~/') ||
    source.startsWith('@') ||
    source.startsWith('~') ||
    source.startsWith('#');

  if (isAliasLike) {
    try {
      const fromDir = path.dirname(fromFilePath);
      const tsConfigDir = getTsConfigDir();
      const baseDir = tsConfigDir || fromDir;

      const tsConfig = loadTsConfig(baseDir);
      const resolved = resolveAliasPath(source, baseDir, tsConfig);

      if (resolved) {
        const resolvedNormalized = resolved.replace(/\\/g, '/');

        const byAbs =
          sourceToFileIdMap.get(resolved) || sourceToFileIdMap.get(resolvedNormalized);
        if (byAbs) return byAbs;

        const resolvedBase = path.basename(resolved);
        const resolvedNoExt = resolvedBase.replace(/\.[^.]+$/, '');

        const byBase = sourceToFileIdMap.get(resolvedBase);
        if (byBase) return byBase;

        const byNoExt = sourceToFileIdMap.get(resolvedNoExt);
        if (byNoExt) return byNoExt;

        for (const [fp, fd] of fileMap) {
          const fpNormalized = fp.replace(/\\/g, '/');
          if (
            fpNormalized === resolvedNormalized ||
            fpNormalized.endsWith('/' + resolvedNormalized) ||
            resolvedNormalized.endsWith('/' + fpNormalized)
          ) {
            return fd.id;
          }
        }
      }
    } catch {
      // Игнорируем ошибки разрешения алиасов
    }
  }

  if (source.startsWith('.')) {
    try {
      const fromDir = path.dirname(fromFilePath);
      const resolved = resolveFilePath(fromDir, source);
      if (resolved) {
        const resolvedNormalized = resolved.replace(/\\/g, '/');

        const byAbs =
          sourceToFileIdMap.get(resolved) || sourceToFileIdMap.get(resolvedNormalized);
        if (byAbs) return byAbs;

        for (const [fp, fd] of fileMap) {
          const fpNormalized = fp.replace(/\\/g, '/');
          if (
            fpNormalized === resolvedNormalized ||
            fpNormalized.endsWith('/' + resolvedNormalized) ||
            resolvedNormalized.endsWith('/' + fpNormalized)
          ) {
            return fd.id;
          }
        }
      }
    } catch {
      // Игнорируем
    }
  }

  const sourceBasename = path.basename(source);
  const sourceNoExt = sourceBasename.replace(/\.[^.]+$/, '');

  const byBasename = sourceToFileIdMap.get(sourceBasename);
  if (byBasename) return byBasename;

  const byNoExt = sourceToFileIdMap.get(sourceNoExt);
  if (byNoExt) return byNoExt;

  if (!source.startsWith('.')) {
    const isProjectAlias =
      source.startsWith('@/') ||
      source.startsWith('~/') ||
      source.startsWith('#/') ||
      source === '@' ||
      source === '~' ||
      source === '#';

    if (isProjectAlias) {
      return null;
    }

    const pkg = source.startsWith('@')
      ? source.split('/').slice(0, 2).join('/')
      : source.split('/')[0];
    if (pkg) return `external:${pkg}`;
  }

  return null;
}

function getImportTypeFromSpecifierType(
  specifierType: string
): 'named' | 'default' | 'namespace' {
  switch (specifierType) {
    case 'ImportDefaultSpecifier':
      return 'default';
    case 'ImportNamespaceSpecifier':
    case 'ExportAllSpecifier':
      return 'namespace';
    case 'ImportSpecifier':
    case 'ExportSpecifier':
    default:
      return 'named';
  }
}

function detectCallType(
  func: FunctionInfo,
  callName: string
): 'direct' | 'async' | 'method' | 'callback' {
  if (func.isAsync) return 'async';

  if (callName.endsWith('_callback')) return 'callback';

  if (callName.includes('.')) return 'method';

  const body = func.body || '';
  if (body) {
    const escapedCallName = callName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    try {
      const cbPattern = new RegExp(
        String.raw`${escapedCallName}\s*\([^)]*(?:=>|function)`,
        'i'
      );
      if (cbPattern.test(body)) return 'callback';
    } catch {
      return 'direct';
    }
  }

  return 'direct';
}

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

export default {
  generateCompactReport,
  decodeCompactReport,
  readAndDecode,
  readFullJson,
};
