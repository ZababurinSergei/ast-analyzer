// src/reporters/compact-reporter.ts
// ============================================
// ТОНКИЙ ОРКЕСТРАТОР КОМПАКТНОГО ОТЧЁТА
// ============================================
// Версия: 16.0.8
//
// ════════════════════════════════════════════════════════════
// СВОДКА ВЕРСИЙ
// ════════════════════════════════════════════════════════════
//
// v16.0.8 (архитектурное исправление: единый анализ <template>):
//   - ✅ УДАЛЕНА функция analyzeVueSFC из compact-reporter.ts.
//   - ✅ УДАЛЕНА функция extractSFCNamesForVue из compact-reporter.ts.
//   - ✅ УДАЛЕН двойной вызов analyzeVueSFC для каждого SFC.
//   - ✅ ЗАМЕНЕНО: compact-reporter.ts теперь ЧИТАЕТ
//     templateComponentUsages/templateHtmlElements из enhancedMap.
//   - ✅ ЗАМЕНЕНО: sfc.props/emits/exposed читаются из
//     enhancedMap[file].vueAnalysis (без повторного parseVueFile).
//   - ✅ ДОБАВЛЕНЫ поля templateComponentUsages/templateHtmlElements:
//       • EntitiesResult (src/types.ts)
//       • EnhancedEntityInfo (src/types.ts)
//       • VueComponentAnalysis (src/modes/vue-analyzer/types.ts)
//       • propagateTemplateFields (normalize-entities.ts)
//       • convertEntitiesToEnhanced (converters.ts)
//       • convertVueAnalysisToEntities (convert-analysis.ts)
//   - ✅ ВЫНЕСЕНЫ типы Vue-шаблона в src/types-vue-template.ts
//     (разрыв циклического импорта types.ts ↔ codec-types.ts).
//   - 🐛 ПРИЧИНА: двойной парсинг <template> приводил к:
//       • потере projectRoot во втором проходе (баг с Vue SFC);
//       • двойной работе (13 сек вместо 5 сек);
//       • дублированию логики.
//   - 📊 ЭФФЕКТ: время сборки сокращается с ~13 сек до ~5 сек.
//
// v16.0.7 (fix: projectRoot для Vue SFC):
//   - ✅ ИСПРАВЛЕНО: `generateCompactReport` теперь принимает
//     `projectRoot` через `GenerateReportOptions` и пробрасывает
//     его в `collectFullJSON`.
//   - ✅ ИСПРАВЛЕНО: `collectFullJSON` больше НЕ использует
//     `process.cwd()` — принимает `projectRoot` параметром.
//   - ✅ ИСПРАВЛЕНО: расширен набор кандидатов для поиска SFC:
//     добавлен fallback по суффиксу пути в `entitiesMap`.
//   - 🐛 ПРИЧИНА: при запуске `compact-recursive ./infoenergo-ui/src/index.ts`
//     из корня пакета `ast-analyzer`, `process.cwd()` = корень пакета,
//     а Vue SFC лежат в `infoenergo-ui/src/`. В результате все 75 SFC
//     не находились на диске (`componentUsages`/`htmlElements` = 0).
//   - ✅ СИНХРОНИЗИРОВАНО с:
//       • codec/codec-types.ts     (CODEC_VERSION = '16.0.7')
//       • codec/codec-decode.ts    (v16.0.4)
//       • codec/codec-encode.ts    (v16.0.4)
//       • codec/codec-legend.ts    (v16.0.4)
//       • pipeline/stages/build-report.ts (v2.1.0)
//
// v16.0.6 (диагностика анализа <template>):
//   - ✅ ДОБАВЛЕНО: расширенная диагностика в `analyzeVueSFC` —
//     логирование start/end, existsSync, размера файла,
//     hasTemplate (regex), количества cu/he/errors.
//   - ✅ ДОБАВЛЕНО: диагностика в цикле `for (const sfc of vue.sfc || [])` —
//     вывод projectRoot, process.cwd(), каждого резолвнутого пути,
//     количества not-found SFC.
//   - ✅ ДОБАВЛЕНО: fallback-резолвинг путей через basename в
//     `workingEntitiesMap` (страховка от неверного projectRoot).
//   - ✅ ДОБАВЛЕНО: итоговая диагностика после цикла —
//     "Проанализировано / Пропущено / componentUsages / htmlElements".
//   - ✅ ДОБАВЛЕНО: предупреждение, если SFC не найдены на диске.
//   - ✅ ОБНОВЛЕНО: `extractSFCNamesForVue` — расширенная диагностика.
//   - ✅ СИНХРОНИЗИРОВАНО с:
//       • codec/codec-decode.ts (v16.0.4)
//       • codec/codec-encode.ts (v16.0.4)
//       • codec/codec-types.ts  (CODEC_VERSION = '16.0.4')
//       • codec/codec-legend.ts (v16.0.4)
//
// v16.0.5 (P0/P1: восстановление DOM API + Component Usage):
//   - ✅ FIX: `analyzeVueSFC` теперь ВСЕГДА логирует результат.
//   - ✅ FIX: `extractSFCNamesForVue` использует parseVueFile
//     вместо regex.
//   - ✅ FIX: `buildScopeForFunction` принимает originalAbsolutePath.
//   - ✅ FIX: `isLikelyDomReceiver` расширена эвристиками.
//
// v16.0.4 (симметрия top-level component* с codec-decode.ts):
//   - ✅ ГАРАНТИРОВАНО: full.componentProps, full.componentEvents,
//     full.componentDirectives, full.componentSlots,
//     full.htmlInterpolations — ВСЕГДА присутствуют в FullJSON.
//
// v16.0.2 (симметричный round-trip vue.sfc[].componentUsages/htmlElements):
//   - ✅ ГАРАНТИРОВАНО: sfc[].componentUsages и sfc[].htmlElements
//     ВСЕГДА добавляются в FullJSON, даже если пусты [].
//
// v16.0.1 (fix TS6192 + TS6196 + TS6133):
// v16.0.0 (Component Usage + DOM API + sourceChains):
// v15.5.7 (fix: явный проброс vueKind + диагностика):
// v15.5.6 (fix TS2614 + TS2339 + синхронизация Vue-секции):
// v15.5.5 (JSON-safe сериализация):
// v15.5.4 (устранение рассинхрона порогов):
// v15.5.3 (fix: детерминизм shouldKeepValue):
// v15.5.2 (P0-fix-2 — стабилизация порядка обхода):
// v15.5.1 (P0-fix — резолвинг parentFunctionId):
// v15.5.0 (MVP P0/P1/P2 — проброс в FullJSON):
// v15.4.0 (P3 — cross-file resolution):
// v15.0.7 (fix isExternal ↔ toFileId desync):
// v15.0.6 (isExternal — производное от imp.toFileId):
// v15.0.4 (заполнение importedName/localName + реэкспорты):
// v15.0.3 (нормализация путей в отчёте):
// v15.0.2 (устранение дублирования conditionals):
// v15.0.1 (fix imports[].type):
// v14.0.0 (canonicalizeFullJSON в конце collectFullJSON):
// v13.0.0 (ValuesMode импортируется из values-filter.js):
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
import { parseVueFile } from '../modes/vue-analyzer/parser.js';
// ✅ v15.5.5: JSON-safe сериализация
import { jsonSafeStringify, isJsonSafe } from './codec/stable-stringify.js';

// ✅ v15.5.4: единый критерий фильтрации значений
import { isValueKept } from './codec/values-filter.js';
import type { ValuesMode } from './codec/values-filter.js';

// ✅ v15.5.3: единые extractNumericId / sortByIdNumeric / canonicalizeFullJSON
import { canonicalizeFullJSON } from './utils/canonical-utils.js';

// ✅ v15.5.6: Vue-классификатор
import { classifyVueEntities } from '../core/vue-entity-classifier.js';
import type { VueEntities } from '../core/vue-entity-classifier.js';

// ✅ v16.0.8: parseVueTemplate / extractSFCNames / parseVueFile УДАЛЕНЫ —
// они больше не используются в compact-reporter.ts. Вся логика анализа
// <template> перенесена в pipeline (ParseFileStage → analyzeVueComponent).

// ✅ v16.0.0: ts-morph для DOM API
import { Project as TsMorphProject, Node as TsNode, SyntaxKind } from 'ts-morph';

// ✅ FIX v16.0.8: сериализация sourceChain для full.ids/full.sourceChains
import { serializeSourceChain } from '../core/source-chain-resolver.js';

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
  LexicalLink,
  VueSectionFull,
  VueKind,
  ComponentUsage,
  HtmlElementUsage,
  DomApiCall,
} from './codec/codec-types.js';

// ✅ v13.0.0-fix: единая версия CODEC
// ✅ v16.0.8: CODEC_VERSION = '16.0.8' (синхронизировано с codec-types.ts)
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
// ✅ v9.0.0: РЕЭКСПОРТ ТИПОВ
// ============================================
export type { GenerateReportOptions, GenerateReportResult } from './codec/codec-types.js';
export type { ValuesMode } from './codec/values-filter.js';
export type { VueEntities } from '../core/vue-entity-classifier.js';

// ============================================
// КОНСТАНТЫ
// ============================================

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

  // ✅ v16.0.7: ИСПРАВЛЕНО
  //
  // КРИТИЧНО: projectRoot — реальный корень анализируемого проекта.
  //
  // Без этого Vue SFC ищутся относительно process.cwd() (корень
  // пакета ast-analyzer), а не относительно анализируемого проекта
  // (infoenergo-ui). Это приводит к тому, что все 75 SFC не
  // находятся на диске, и componentUsages/htmlElements = 0.
  //
  // Если options.projectRoot не задан — fallback на process.cwd()
  // для обратной совместимости (например, при прямом вызове
  // generateCompactReport без pipeline).
  const projectRoot = options.projectRoot || process.cwd();

  if (verbose) {
    console.log(`   🏠 projectRoot: ${projectRoot}`);
  }

  // ✅ v9.0.4: edges
  const saveEdges = options.saveEdges === true;
  const edgesSuffix = options.edgesJsonSuffix || '.edges.json';

  // ============================================
  // ШАГ 1: Сбор полного JSON
  // ============================================
  if (verbose) {
    console.log('\\n📦 [compact-reporter] Сбор полного JSON...');
    console.log(`   🎛️  valuesMode: ${valuesMode}`);
  }

  // ✅ v16.0.7: проброс projectRoot в collectFullJSON
  const full = collectFullJSON(entitiesMap, verbose, valuesMode, undefined, projectRoot);

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

    if (full.vue) {
      console.log(`   📦 Vue SFC: ${full.vue.sfc.length}`);
      console.log(`   ◇  Composables: ${full.vue.composables.length}`);
      console.log(`   ⚙  Macros: ${full.vue.macros.length}`);
      console.log(`   ⚓ Hooks: ${full.vue.hooks.length}`);
      console.log(`   ⚡ Reactivity: ${full.vue.reactivity.length}`);
      console.log(`   🖼  Icons: ${full.vue.icons.length}`);
    }

    // ✅ v16.0.0: диагностика новых секций
    console.log(`   🌐 ComponentUsages: ${(full as any).componentUsages?.length || 0}`);
    console.log(`   🖥  DomApiCalls: ${full.domApiCalls?.length || 0}`);
    console.log(`   🌿 HtmlVisibleFns: ${full.statistics.totalHtmlVisibleFns || 0}`);

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

    if (full.functions.length > 0 && fnsWithVueKind < full.functions.length * 0.5) {
      console.warn(
        `   ⚠️  vueKind отсутствует у ${full.functions.length - fnsWithVueKind}/${full.functions.length} функций`
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
    } else {
      console.log(`   ✅ Все импорты разрешены`);
    }

    // ✅ v15.5.5: диагностика не-JSON-значений
    if (full.constants) {
      let unsafeCount = 0;
      for (const cn of full.constants) {
        if (cn.value !== undefined && !isJsonSafe(cn.value)) {
          unsafeCount++;
        }
      }
      if (unsafeCount > 0) {
        console.warn(
          `   ⚠️  ${unsafeCount} констант содержат не-JSON-значения`
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

      if (compact.vue) {
        console.log(`   📦 compact.vue.sfc.f: ${compact.vue.sfc.f.length}`);
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
    console.log('✅ [compact-reporter] Готово\\n');
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

export function decodeCompactReport(
  compact: CompactJSON,
  options: DecodeOptions = {}
): FullJSON {
  return Codec.decode(compact, options);
}

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

function countConditionals(full: FullJSON): number {
  let count = 0;
  for (const template of full.templates ?? []) {
    count += (template.conditionals ?? []).length;
  }
  return count;
}

// ============================================
// ✅ v15.4.0 (P3): ОБОГАЩЕНИЕ CALLS
// ============================================

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
    const relativePath = path.relative(projectRoot, absolutePath).replace(/\\\\/g, '/');

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
// ✅ v16.0.4: VUE-СЕКЦИЯ — КОНВЕРТЕР (симметричный)
// ============================================
//
// КЛЮЧЕВОЕ:
//   - sfc[].componentUsages и sfc[].htmlElements ВСЕГДА присутствуют
//     (даже пустыми []).
//   - Top-level componentProps/componentEvents/componentDirectives/
//     componentSlots/htmlInterpolations ВСЕГДА присутствуют (даже []).
//     Это симметризует compact-reporter с codec-decode.ts v16.0.4.
// ============================================

function convertVueEntitiesToFull(
  vueEntities: VueEntities,
  fileMap: Map<string, FileData>,
  projectRoot: string
): VueSectionFull {
  const resolveFileId = (filePath: string): string => {
    const absolutePath = path.resolve(filePath);
    const relativePath = path.relative(projectRoot, absolutePath).replace(/\\\\/g, '/');
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
    sfc: (vueEntities.sfc ?? []).map(s => ({
      fileId: resolveFileId(s.fileId),
      moduleId: resolveModuleId(s.fileId),
      name: s.name,
      blocks: s.blocks,
      composables: s.composables ?? [],
      props: s.props ?? [],
      emits: s.emits ?? [],
      exposed: s.exposed ?? [],
      // ✅ v16.0.2: ВСЕГДА добавляем пустые массивы.
      // Они будут заполнены ниже в блоке "Component Usage".
      componentUsages: [],
      htmlElements: [],
    })),

    composables: (vueEntities.composables ?? []).map(c => ({
      id: c.id,
      name: c.name,
      fileId: resolveFileId(c.fileId),
      kind: c.kind,
      returnShape: c.returnShape,
      returnedKeys: c.returnedKeys ?? [],
      callers: (c.callers ?? []).map(resolveFileId),
    })),

    macros: (vueEntities.macros ?? []).map(m => ({
      id: m.id,
      fileId: resolveFileId(m.fileId),
      kind: m.kind,
      line: m.line,
    })),

    hooks: (vueEntities.hooks ?? []).map(h => ({
      id: h.id,
      fileId: resolveFileId(h.fileId),
      hookName: h.hookName,
      line: h.line,
    })),

    reactivity: (vueEntities.reactivity ?? []).map(r => ({
      id: r.id,
      fileId: resolveFileId(r.fileId),
      kind: r.kind,
      line: r.line,
      name: r.name,
    })),

    icons: (vueEntities.icons ?? []).map(i => ({
      id: resolveFileId(i.fileId) ? `ic${i.id}` : i.id,
      fileId: resolveFileId(i.fileId),
      name: i.name,
      category: i.category,
    })),

    // ✅ v16.0.4: симметрия с codec-decode.ts v16.0.4 —
    // ВСЕГДА инициализируем top-level component*-поля (даже []).
    // Реальные значения заполняются в collectFullJSON после
    // блока "Component Usage".
    componentProps: [],
    componentEvents: [],
    componentDirectives: [],
    componentSlots: [],
    htmlInterpolations: [],
  };
}

// ============================================
// ✅ v16.0.0: DOM API — buildScope + detectDomApiCalls
// ============================================

interface ScopeLocal {
  functionId?: string;
  subkind?: 'ref' | 'computed' | 'watch' | 'function' | 'method' | 'constant';
  isRef?: boolean;
  isDomElement?: boolean;
  typeHint?: string;
}

interface ScopeInternal {
  fileId: string;
  sourceFile: any;
  locals: Map<string, ScopeLocal>;
  imports: Map<string, { functionId?: string; sourceFileId?: string }>;
  globals: Set<string>;
  refs: Set<string>;
}

/**
 * ✅ v16.0.5: Строит scope для функции.
 *
 * Ключевое изменение: параметр `originalAbsolutePath` — реальный
 * путь к .vue или .ts файлу. Используется как fallback для поиска
 * SourceFile, если виртуальный `scriptPath` не найден в Project.
 *
 * НЕ возвращает null при ошибке — продолжает с тем, что есть
 * (scope.locals/imports/refs заполнены из entitiesMap).
 */
function buildScopeForFunction(
  _fn: any,
  scriptPath: string,
  fileId: string,
  entitiesMap: Record<string, EntitiesResult>,
  tsProject: TsMorphProject,
  originalAbsolutePath?: string
): ScopeInternal | null {
  const scope: ScopeInternal = {
    fileId,
    sourceFile: null,
    locals: new Map(),
    imports: new Map(),
    globals: new Set([
      'window', 'document', 'globalThis', 'console', 'Math', 'JSON',
      'Object', 'Array', 'Promise', 'Date', 'RegExp', 'Error',
      'Map', 'Set', 'WeakMap', 'WeakSet', 'Symbol', 'Number',
      'String', 'Boolean', 'parseInt', 'parseFloat', 'isNaN', 'isFinite',
    ]),
    refs: new Set(),
  };

  // 1. Локальные переменные из entities
  const entities = entitiesMap[scriptPath] ?? entitiesMap[originalAbsolutePath ?? ''] ?? null;
  if (entities) {
    for (const v of entities.variables || []) {
      if (v.name) scope.locals.set(v.name, { subkind: 'constant' });
    }
    for (const c of entities.constants || []) {
      if (c.name) scope.locals.set(c.name, { subkind: 'constant' });
    }
    for (const f of entities.functions || []) {
      if (f.name) {
        scope.locals.set(f.name, {
          functionId: f.id,
          subkind: 'function',
        });
      }
    }
  }

  // 2. Импорты
  if (entities) {
    for (const imp of entities.imports || []) {
      for (const spec of imp.specifiers || []) {
        const s = typeof spec === 'string' ? { local: spec, imported: spec } : spec;
        if (s.local) {
          scope.imports.set(s.local, {
            sourceFileId: (imp as any).toFileId,
          });
        }
      }
    }
  }

  // 3. Vue refs (эвристика)
  if (entities) {
    for (const v of entities.variables || []) {
      if (v.name && (v.name.endsWith('Ref') || v.name.endsWith('El'))) {
        scope.refs.add(v.name);
      }
    }
  }

  // 4. SourceFile через ts-morph
  //
  // ✅ v16.0.5: Ищем SourceFile по scriptPath (виртуальному).
  // Если не найден — пробуем originalAbsolutePath (реальный).
  // Если и там нет — возвращаем scope БЕЗ sourceFile (не null!),
  // чтобы DOM-детектор мог использовать scope.locals/imports/refs
  // из entitiesMap.
  try {
    let sf = tsProject.getSourceFile(scriptPath);

    // Fallback 1: virtual path мог быть создан с другим ключом
    if (!sf && originalAbsolutePath) {
      sf = tsProject.getSourceFile(originalAbsolutePath);
    }

    // Fallback 2: реальный файл на диске
    if (!sf && originalAbsolutePath && fs.existsSync(originalAbsolutePath)) {
      try {
        sf = tsProject.addSourceFileAtPath(originalAbsolutePath);
      } catch {
        // ignore
      }
    }

    // Fallback 3: scriptPath (если виртуальный файл на диске — маловероятно, но возможно)
    if (!sf && fs.existsSync(scriptPath)) {
      try {
        sf = tsProject.addSourceFileAtPath(scriptPath);
      } catch {
        // ignore
      }
    }

    if (sf) {
      scope.sourceFile = sf;
      sf.forEachDescendant((node: any) => {
        if (TsNode.isVariableDeclaration(node)) {
          const name = node.getName();
          if (name && !scope.locals.has(name)) {
            const init = node.getInitializer();
            const isRef = init ? isRefCall(init) : false;
            const isDom = init ? isDomElementCreation(init) : false;
            scope.locals.set(name, {
              isRef,
              isDomElement: isDom,
              subkind: 'constant',
            });
            if (isRef) scope.refs.add(name);
          }
        }
      });
    } else if (process.env.AST_DEBUG_VUE === 'true') {
      console.warn(
        `   ⚠️ buildScopeForFunction: SourceFile не найден ни по scriptPath, ни по originalAbsolutePath`
      );
      console.warn(`      scriptPath: ${scriptPath}`);
      console.warn(`      originalAbsolutePath: ${originalAbsolutePath ?? '<не задан>'}`);
    }
  } catch (err) {
    if (process.env.AST_DEBUG_VUE === 'true') {
      console.warn(`   ⚠️ buildScopeForFunction: exception:`, err);
    }
    // ❌ НЕ возвращаем null — продолжаем с тем, что есть
  }

  return scope;
}

function isRefCall(node: any): boolean {
  if (!TsNode.isCallExpression(node)) return false;
  const expr = node.getExpression();
  if (!TsNode.isIdentifier(expr)) return false;
  const name = expr.getText();
  return ['ref', 'shallowRef', 'computed', 'reactive', 'customRef', 'toRef', 'toRefs'].includes(name);
}

function isDomElementCreation(node: any): boolean {
  if (!TsNode.isCallExpression(node)) return false;
  const expr = node.getExpression();
  if (!TsNode.isPropertyAccessExpression(expr)) return false;
  const text = expr.getText();
  return text === 'document.createElement' || text === 'document.querySelector' ||
    text === 'document.getElementById';
}

// ============================================
// DOM method map
// ============================================

interface DomMethodInfoLocal {
  category: string;
  effect: 'write' | 'read' | 'mixed';
}

const DOM_METHOD_MAP_LOCAL: Record<string, DomMethodInfoLocal> = {
  addEventListener: { category: 'add-event-listener', effect: 'mixed' },
  removeEventListener: { category: 'remove-event-listener', effect: 'mixed' },
  dispatchEvent: { category: 'dispatch-event', effect: 'write' },
  createElement: { category: 'create-element', effect: 'write' },
  appendChild: { category: 'append-child', effect: 'write' },
  insertBefore: { category: 'insert-before', effect: 'write' },
  removeChild: { category: 'remove-child', effect: 'write' },
  replaceChild: { category: 'replace-child', effect: 'write' },
  cloneNode: { category: 'clone-node', effect: 'write' },
  importNode: { category: 'import-node', effect: 'write' },
  adoptNode: { category: 'adopt-node', effect: 'write' },
  insertAdjacentHTML: { category: 'insert-adjacent-html', effect: 'write' },
  insertAdjacentElement: { category: 'insert-adjacent-element', effect: 'write' },
  insertAdjacentText: { category: 'insert-adjacent-text', effect: 'write' },
  setAttribute: { category: 'set-attribute', effect: 'write' },
  removeAttribute: { category: 'remove-attribute', effect: 'write' },
  getAttribute: { category: 'get-attribute', effect: 'read' },
  hasAttribute: { category: 'has-attribute', effect: 'read' },
  toggleAttribute: { category: 'toggle-attribute', effect: 'write' },
  querySelector: { category: 'query-selector', effect: 'read' },
  querySelectorAll: { category: 'query-selector-all', effect: 'read' },
  getElementById: { category: 'get-element-by-id', effect: 'read' },
  getElementsByClassName: { category: 'get-elements-by-class', effect: 'read' },
  getElementsByTagName: { category: 'get-elements-by-tag', effect: 'read' },
  getElementsByName: { category: 'get-elements-by-name', effect: 'read' },
  closest: { category: 'closest', effect: 'read' },
  matches: { category: 'matches', effect: 'read' },
  getRootNode: { category: 'get-root-node', effect: 'read' },
  focus: { category: 'focus', effect: 'write' },
  blur: { category: 'blur', effect: 'write' },
  scrollIntoView: { category: 'scroll-into-view', effect: 'write' },
  scrollTo: { category: 'scroll-to', effect: 'write' },
  click: { category: 'click-programmatic', effect: 'write' },
};

const DOM_PROPERTY_MAP_LOCAL: Record<string, DomMethodInfoLocal> = {
  innerHTML: { category: 'inner-html', effect: 'write' },
  outerHTML: { category: 'outer-html', effect: 'write' },
  textContent: { category: 'text-content', effect: 'write' },
  innerText: { category: 'inner-text', effect: 'write' },
  className: { category: 'set-property', effect: 'write' },
  dataset: { category: 'dataset', effect: 'write' },
  style: { category: 'style-set', effect: 'write' },
  classList: { category: 'class-list', effect: 'write' },
  value: { category: 'set-property', effect: 'write' },
  checked: { category: 'set-property', effect: 'write' },
  disabled: { category: 'set-property', effect: 'write' },
  src: { category: 'set-property', effect: 'write' },
  href: { category: 'set-property', effect: 'write' },
};

const DOM_OBSERVER_MAP_LOCAL: Record<string, string> = {
  MutationObserver: 'mutation-observer',
  ResizeObserver: 'resize-observer',
  IntersectionObserver: 'intersection-observer',
  PerformanceObserver: 'performance-observer',
};

// ============================================
// ✅ v16.0.5: isLikelyDomReceiver — расширенная эвристика
// ============================================

/**
 * ✅ v16.0.5: Эвристика "является ли receiver DOM-элементом".
 */
function isLikelyDomReceiver(expr: any, scope: ScopeInternal): boolean {
  if (!expr) return false;

  // ─────────────────────────────────────────────
  // 1. Identifier
  // ─────────────────────────────────────────────
  if (TsNode.isIdentifier(expr)) {
    const name = expr.getText();

    // 1.1. Глобальные объекты
    if (['document', 'window', 'globalThis', 'navigator', 'location'].includes(name)) {
      return true;
    }

    // 1.2. Из scope.locals
    const local = scope.locals.get(name);
    if (local?.isRef || local?.isDomElement) return true;
    if (local?.typeHint && /Element|Node|HTML|HTMLElement|SVGElement/.test(local.typeHint)) {
      return true;
    }

    // 1.3. Эвристика по имени (templateRefs, DOM-элементы)
    if (
      name.endsWith('Ref') ||
      name.endsWith('El') ||
      name.endsWith('Element') ||
      name.endsWith('Node') ||
      name === 'el' ||
      name === 'root'
    ) {
      return true;
    }
  }

  // ─────────────────────────────────────────────
  // 2. Текстовые префиксы
  // ─────────────────────────────────────────────
  let text: string;
  try {
    text = expr.getText();
  } catch {
    return false;
  }

  if (text.startsWith('document.') || text.startsWith('window.')) return true;
  if (text.startsWith('this.$refs.') || text.startsWith('this.$el')) return true;
  if (text.startsWith('this.')) {
    if (/^this\\.[\\w$]+(?:Ref|El|Element|Node)\\b/.test(text)) return true;
  }

  // ─────────────────────────────────────────────
  // 3. CallExpression: document.querySelector(...)
  // ─────────────────────────────────────────────
  if (TsNode.isCallExpression(expr)) {
    let calleeText: string;
    try {
      calleeText = expr.getExpression().getText();
    } catch {
      return false;
    }

    if (/^(document|window)\\./.test(calleeText)) return true;
    if (/^(document|window)\\.(querySelector|querySelectorAll|getElementById|getElementsBy)/.test(calleeText)) {
      return true;
    }

    if (TsNode.isPropertyAccessExpression(expr.getExpression())) {
      const inner = expr.getExpression() as any;
      const innerText = inner.getText();
      if (/\\bquerySelector\\b|\\bgetElementById\\b/.test(innerText)) return true;
    }
  }

  // ─────────────────────────────────────────────
  // 4. PropertyAccess: *.value
  // ─────────────────────────────────────────────
  if (TsNode.isPropertyAccessExpression(expr) && expr.getName() === 'value') {
    const refExpr = expr.getExpression();
    let refName: string;
    try {
      refName = refExpr.getText();
    } catch {
      return false;
    }

    if (scope.refs.has(refName)) return true;
    if (scope.locals.get(refName)?.isRef) return true;

    if (
      refName.endsWith('Ref') ||
      refName.endsWith('El') ||
      refName.endsWith('Element') ||
      refName.endsWith('Node')
    ) {
      return true;
    }

    if (/^this\\.[\\w$]+$/.test(refName)) {
      if (/Ref|El|Element|Node/.test(refName)) return true;
    }
  }

  return false;
}

// ============================================
// resolveTarget
// ============================================

function resolveTargetLocal(expr: any, scope: ScopeInternal): { target: string; targetKind: string } {
  const text = expr.getText();

  if (text === 'document') return { target: 'document', targetKind: 'document' };
  if (text === 'window') return { target: 'window', targetKind: 'window' };

  if (text.startsWith('document.querySelector')) {
    const m = text.match(/querySelector\\(['"`]([^'"`]+)['"`]\\)/);
    return { target: `query:${m ? m[1] : '?'}`, targetKind: 'query' };
  }
  if (text.startsWith('document.')) return { target: text, targetKind: 'document' };
  if (text.startsWith('this.$refs.')) return { target: `ref:${text.split('.')[2] || '?'}`, targetKind: 'ref' };

  if (TsNode.isPropertyAccessExpression(expr) && expr.getName() === 'value') {
    const refName = expr.getExpression().getText();
    if (scope.refs.has(refName)) return { target: `ref:${refName}`, targetKind: 'ref' };
  }

  if (TsNode.isIdentifier(expr)) {
    const name = expr.getText();
    if (scope.locals.has(name)) return { target: `variable:${name}`, targetKind: 'variable' };
    if (scope.imports.has(name)) return { target: `import:${name}`, targetKind: 'variable' };
  }

  return { target: text, targetKind: 'unknown' };
}

// ============================================
// resolveArg
// ============================================

function resolveArgLocal(node: any, index: number, scope: ScopeInternal): any {
  const raw = node.getText();
  let kind = 'identifier';

  if (TsNode.isStringLiteral(node)) kind = 'literal-string';
  else if (TsNode.isNumericLiteral(node)) kind = 'literal-number';
  else if (node.getKind() === SyntaxKind.TrueKeyword || node.getKind() === SyntaxKind.FalseKeyword) kind = 'literal-bool';
  else if (TsNode.isArrowFunction(node) || TsNode.isFunctionExpression(node)) kind = 'arrow';
  else if (TsNode.isObjectLiteralExpression(node)) kind = 'object';
  else if (TsNode.isCallExpression(node)) kind = 'call';
  else if (TsNode.isPropertyAccessExpression(node)) kind = 'member';

  const result: any = { index, raw, kind };

  if (TsNode.isIdentifier(node)) {
    const name = node.getText();
    const local = scope.locals.get(name);
    if (local?.functionId) {
      result.resolvedFunctionId = local.functionId;
      result.resolvedSource = 'local';
    } else if (scope.imports.has(name)) {
      result.resolvedSource = 'import';
    } else {
      result.resolvedSource = 'unknown';
    }
  } else if (TsNode.isArrowFunction(node) || TsNode.isFunctionExpression(node)) {
    result.resolvedSource = 'local';
  }

  return result;
}

// ============================================
// extractContext
// ============================================

function extractContextLocal(
  category: string,
  args: any[],
  scope: ScopeInternal
): any {
  const ctx: any = {};

  if (['add-event-listener', 'remove-event-listener', 'dispatch-event'].includes(category)) {
    if (args[0] && TsNode.isStringLiteral(args[0])) {
      ctx.eventName = args[0].getLiteralValue();
    }
    if (category === 'add-event-listener' && args[1]) {
      if (TsNode.isIdentifier(args[1])) {
        const name = args[1].getText();
        const local = scope.locals.get(name);
        if (local?.functionId) {
          ctx.handlerFunctionId = local.functionId;
          ctx.handlerSource = 'local';
        } else if (scope.imports.has(name)) {
          ctx.handlerSource = 'import';
        } else {
          ctx.handlerSource = 'unknown';
        }
      } else if (TsNode.isArrowFunction(args[1]) || TsNode.isFunctionExpression(args[1])) {
        ctx.handlerSource = 'inline';
      }
    }
  }

  if (['query-selector', 'query-selector-all', 'closest', 'matches'].includes(category)) {
    if (args[0] && TsNode.isStringLiteral(args[0])) {
      ctx.cssSelector = args[0].getLiteralValue();
    }
  }

  if (['inner-html', 'outer-html', 'insert-adjacent-html'].includes(category)) {
    const idx = category === 'insert-adjacent-html' ? 1 : 0;
    if (args[idx] && TsNode.isStringLiteral(args[idx])) {
      ctx.htmlValue = args[idx].getLiteralValue();
    }
  }

  if (['set-attribute', 'remove-attribute', 'get-attribute', 'has-attribute', 'toggle-attribute'].includes(category)) {
    if (args[0] && TsNode.isStringLiteral(args[0])) {
      ctx.attributeName = args[0].getLiteralValue();
    }
  }

  return ctx;
}

// ============================================
// ✅ v16.0.5: detectDomApiCallsForFunction
// ============================================

/**
 * ✅ v16.0.5: Детектор DOM API-вызовов для одной функции.
 */
function detectDomApiCallsForFunction(
  fn: any,
  scriptPath: string,
  fileId: string,
  entitiesMap: Record<string, EntitiesResult>,
  tsProject: TsMorphProject,
  idCounter: { value: number },
  originalAbsolutePath?: string
): any[] {
  const scope = buildScopeForFunction(
    fn,
    scriptPath,
    fileId,
    entitiesMap,
    tsProject,
    originalAbsolutePath
  );

  if (!scope) return [];

  const calls: any[] = [];
  const sf = scope.sourceFile;

  if (!sf) {
    if (process.env.AST_DEBUG_VUE === 'true') {
      console.warn(
        `   ⚠️ detectDomApiCallsForFunction: scope.sourceFile is null для ${fn.name}`
      );
    }
    return [];
  }

  let targetFn: any = null;

  sf.forEachDescendant((node: any) => {
    if (targetFn) return;
    if (TsNode.isFunctionDeclaration(node) && node.getName() === fn.name) {
      targetFn = node;
    }
    if (TsNode.isVariableDeclaration(node) && node.getName() === fn.name) {
      const init = node.getInitializer();
      if (init && (TsNode.isArrowFunction(init) || TsNode.isFunctionExpression(init))) {
        targetFn = init;
      }
    }
  });

  if (!targetFn) {
    if (process.env.AST_DEBUG_VUE === 'true') {
      console.warn(
        `   ⚠️ detectDomApiCallsForFunction: targetFn не найден для ${fn.name} в ${sf.getFilePath()}`
      );
    }
    return [];
  }

  targetFn.forEachDescendant((node: any) => {
    // 1. CallExpression: obj.method(...)
    if (TsNode.isCallExpression(node)) {
      const expr = node.getExpression();
      if (TsNode.isPropertyAccessExpression(expr)) {
        const methodName = expr.getName();
        const info = DOM_METHOD_MAP_LOCAL[methodName];
        if (info && isLikelyDomReceiver(expr.getExpression(), scope)) {
          const target = resolveTargetLocal(expr.getExpression(), scope);
          const args = node.getArguments();
          idCounter.value++;
          calls.push({
            id: `d${idCounter.value}`,
            functionId: fn.id,
            fileId,
            category: info.category,
            effect: info.effect,
            method: methodName,
            target: target.target,
            targetKind: target.targetKind,
            args: args.map((a: any) => a.getText()),
            argResolutions: args.map((a: any, i: number) => resolveArgLocal(a, i, scope)),
            line: node.getStartLineNumber(),
            column: node.getStart() - sf.getFullStart(),
            context: extractContextLocal(info.category, args, scope),
          });
        }
      }
    }

    // 2. BinaryExpression: obj.innerHTML = ...
    if (TsNode.isBinaryExpression(node)) {
      const op = node.getOperatorToken().getText();
      if (op === '=') {
        const left = node.getLeft();
        if (TsNode.isPropertyAccessExpression(left)) {
          const propName = left.getName();
          const info = DOM_PROPERTY_MAP_LOCAL[propName];
          if (info && isLikelyDomReceiver(left.getExpression(), scope)) {
            const target = resolveTargetLocal(left.getExpression(), scope);
            idCounter.value++;
            calls.push({
              id: `d${idCounter.value}`,
              functionId: fn.id,
              fileId,
              category: info.category,
              effect: info.effect,
              method: `${propName} = ...`,
              target: target.target,
              targetKind: target.targetKind,
              args: [node.getRight().getText()],
              argResolutions: [resolveArgLocal(node.getRight(), 0, scope)],
              line: node.getStartLineNumber(),
              column: node.getStart() - sf.getFullStart(),
              context: extractContextLocal(info.category, [node.getRight()], scope),
            });
          }
        }
      }
    }

    // 3. NewExpression: new MutationObserver(...)
    if (TsNode.isNewExpression(node)) {
      const ctorName = node.getExpression().getText();
      const category = DOM_OBSERVER_MAP_LOCAL[ctorName];
      if (category) {
        const args = node.getArguments() || [];
        idCounter.value++;
        calls.push({
          id: `d${idCounter.value}`,
          functionId: fn.id,
          fileId,
          category,
          effect: 'write',
          method: `new ${ctorName}`,
          target: 'observer',
          targetKind: 'unknown',
          args: args.map((a: any) => a.getText()),
          argResolutions: args.map((a: any, i: number) => resolveArgLocal(a, i, scope)),
          line: node.getStartLineNumber(),
          column: node.getStart() - sf.getFullStart(),
          context: extractContextLocal(category, args, scope),
        });
      }
    }
  });

  return calls;
}

// ════════════════════════════════════════════════════════════
// ✅ v16.0.8: analyzeVueSFC УДАЛЕНА
// ════════════════════════════════════════════════════════════
//
// РАНЬШЕ: compact-reporter.ts вызывал analyzeVueSFC для каждого
// SFC, что приводило к двойному парсингу <template>
// (один раз в pipeline, второй раз здесь).
//
// ТЕПЕРЬ: данные уже собраны в pipeline:
//   ParseFileStage → parseVueFile → analyzeVueComponent
//   → convertVueAnalysisToEntities → EntitiesResult.templateComponentUsages
//   → NormalizeEntitiesStage → propagateTemplateFields
//   → EnhancedEntityInfo.templateComponentUsages
//
// compact-reporter.ts ЧИТАЕТ их напрямую.
//
// См.:
//   - src/types.ts: EntitiesResult.templateComponentUsages
//   - src/types-vue-template.ts
//   - src/core/entity-extractor/vue/convert-analysis.ts
//   - src/reporters/modules/converters.ts
//   - src/pipeline/stages/normalize-entities.ts
// ════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════
// ✅ v16.0.8: extractSFCNamesForVue УДАЛЕНА
// ════════════════════════════════════════════════════════════
//
// РАНЬШЕ: compact-reporter.ts вызывал extractSFCNamesForVue
// для каждого SFC, чтобы получить реальные имена props/emits/exposed
// для vue.sfc[].
//
// ТЕПЕРЬ: эти имена УЖЕ извлечены в pipeline:
//   - VueComponentAnalysis.props.names   (analyzeVueComponent)
//   - VueComponentAnalysis.emits.names   (analyzeVueComponent)
//   - VueComponentAnalysis.expose        (analyzeVueComponent)
//
// При формировании vue.sfc[] в collectFullJSON берём имена
// из workingEntitiesMap[filePath].vueAnalysis.
//
// См. ниже: блок "Vue.sfc[] props/emits/exposed".
// ════════════════════════════════════════════════════════════

// ============================================
// СБОР ПОЛНОГО JSON
// ============================================
//
// ✅ v16.0.7: ИСПРАВЛЕНО
//
// Параметр `projectRoot` теперь передаётся явно (из
// `generateCompactReport`), а не берётся из `process.cwd()`.
//
// Это гарантирует, что все относительные пути (из DiscoverFilesStage)
// резолвятся относительно реального корня проекта.
// ============================================

function collectFullJSON(
  entitiesMap: Record<string, EntitiesResult>,
  verbose: boolean = false,
  valuesMode: ValuesMode = DEFAULT_VALUES_MODE,
  _crossFileCalls?: CrossFileCall[],
  projectRoot: string = process.cwd()
): FullJSON {
  // ✅ v16.0.7: projectRoot теперь параметр, а не process.cwd().
  //
  // Это гарантирует, что все относительные пути (из DiscoverFilesStage)
  // резолвятся относительно реального корня проекта.
  //
  // Если параметр не передан — fallback на process.cwd() для
  // обратной совместимости (прямой вызов collectFullJSON).

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
  // ✅ v16.0.4: аккумуляторы для обратных связей
  // ============================================
  const allComponentProps: any[] = [];
  const allComponentEvents: any[] = [];
  const allComponentDirectives: any[] = [];
  const allComponentSlots: any[] = [];
  const allHtmlInterpolations: any[] = [];

  // ============================================
  // ПЕРВЫЙ ПРОХОД
  // ============================================
  for (const filePath of sortedFilePaths) {
    const entities = workingEntitiesMap[filePath];
    if (!entities) continue;

    const absolutePath = path.resolve(filePath);
    const relativePath = path.relative(projectRoot, absolutePath).replace(/\\\\/g, '/');

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
    const normalizedAbs = absolutePath.replace(/\\\\/g, '/');

    sourceToFileIdMap.set(filePath, file.id);
    sourceToFileIdMap.set(relativePath, file.id);
    sourceToFileIdMap.set(normalizedPath, file.id);
    sourceToFileIdMap.set(absolutePath, file.id);
    sourceToFileIdMap.set(normalizedAbs, file.id);
    sourceToFileIdMap.set(path.basename(relativePath), file.id);
    const baseNoExt = path.basename(relativePath).replace(/\\.[^.]+$/, '');
    sourceToFileIdMap.set(baseNoExt, file.id);
    sourceToFileIdMap.set(relativePath.replace(/\\.[^.]+$/, ''), file.id);

    // ============================================================
    // ФУНКЦИИ
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
    const relativePath = path.relative(projectRoot, absolutePath).replace(/\\\\/g, '/');

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
  // ВТОРОЙ ПРОХОД: экспорты, импорты, вызовы
  // ============================================
  for (const filePath of sortedFilePaths) {
    const entities = workingEntitiesMap[filePath];
    if (!entities) continue;

    const absolutePath = path.resolve(filePath);
    const relativePath = path.relative(projectRoot, absolutePath).replace(/\\\\/g, '/');

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
        !/^f\\d+$/.test(resolvedToFileId) &&
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
              localName = path.basename(imp.source).replace(/\\.[^.]+$/, '');
            } else {
              const fallbackName = path.basename(imp.source).replace(/\\.[^.]+$/, '');
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
            const match = specStr.match(/^(.+?)\\s+as\\s+(.+)$/);
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
              const fallbackName = path.basename(imp.source).replace(/\\.[^.]+$/, '');
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

          if (alreadyExists) continue;

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
  // СБОР РАСШИРЕННЫХ СЕКЦИЙ
  // ============================================
  for (const filePath of sortedFilePaths) {
    const entities = workingEntitiesMap[filePath];
    if (!entities) continue;

    const absolutePath = path.resolve(filePath);
    const relativePath = path.relative(projectRoot, absolutePath).replace(/\\\\/g, '/');

    const dirName = path.basename(path.dirname(relativePath)) || 'root';
    const module = moduleMap.get(dirName);
    const file = fileMap.get(relativePath);
    if (!module || !file) continue;

    const e = entities as any;

    // LIFECYCLE
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

    // EFFECTS
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

    // INJECTIONS
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

    // REACTIVITY
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

    // TYPES
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

    // TYPE REFS
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
  // ✅ v16.0.8: Component Usage + HTML Elements
  // ============================================
  //
  // ⚠️ ГЛАВНОЕ ИЗМЕНЕНИЕ v16.0.8:
  //   РАНЬШЕ здесь вызывался analyzeVueSFC для каждого SFC,
  //   что приводило к двойному парсингу <template>.
  //
  //   ТЕПЕРЬ данные УЖЕ СОБРАНЫ в pipeline:
  //     ParseFileStage → parseVueFile → analyzeVueComponent
  //     → convertVueAnalysisToEntities → templateComponentUsages
  //     → NormalizeEntitiesStage → propagateTemplateFields
  //     → enhancedMap[file].templateComponentUsages
  //
  //   Здесь мы только АГРЕГИРУЕМ их в плоские массивы
  //   и заполняем vue.sfc[].
  //
  // ЭТО УСТРАНЯЕТ:
  //   - двойной парсинг (экономия ~8 сек на 75 SFC);
  //   - рассинхрон projectRoot (второй проход не нужен);
  //   - дублирование логики extractSFCNamesForVue.
  // ============================================
  const allComponentUsages: ComponentUsage[] = [];
  const allHtmlElements: HtmlElementUsage[] = [];

  if (vue) {
    let totalCu = 0;
    let totalHe = 0;
    let notFoundCount = 0;

    for (const sfc of vue.sfc || []) {
      // ✅ Гарантируем, что поля есть (даже пустые)
      if (!Array.isArray(sfc.componentUsages)) sfc.componentUsages = [];
      if (!Array.isArray(sfc.htmlElements)) sfc.htmlElements = [];

      // ✅ v16.0.8: НЕ анализируем заново.
      // Ищем соответствующий enhancedMap[filePath].
      //
      // sfc.fileId — это 'f1', 'f2', ... (ID файла из files[]).
      // Находим filePath по fileId через files[].
      const sfcFile = files.find(f => f.id === sfc.fileId);
      if (!sfcFile) {
        notFoundCount++;
        continue;
      }

      const sfcPath = sfcFile.path; // относительный от projectRoot
      const normalizedSfcPath = sfcPath.replace(/\\\\/g, '/');
      const targetBasename = path.basename(normalizedSfcPath);

      // Пробуем несколько вариантов ключа enhancedMap
      let enhanced: any = workingEntitiesMap[sfcPath];
      if (!enhanced) enhanced = workingEntitiesMap[normalizedSfcPath];
      if (!enhanced) {
        // Fallback 1: поиск по basename
        for (const [key, value] of Object.entries(workingEntitiesMap)) {
          if (path.basename(key) === targetBasename) {
            enhanced = value;
            break;
          }
        }
      }
      if (!enhanced) {
        // Fallback 2: поиск по суффиксу пути
        for (const [key, value] of Object.entries(workingEntitiesMap)) {
          const normalizedKey = key.replace(/\\\\/g, '/');
          if (
            normalizedKey.endsWith('/' + normalizedSfcPath) ||
            normalizedSfcPath.endsWith('/' + normalizedKey)
          ) {
            enhanced = value;
            break;
          }
        }
      }

      if (!enhanced) {
        notFoundCount++;
        if (verbose) {
          console.warn(
            `   ⚠️ v16.0.8: enhancedMap не содержит данных для SFC ${sfc.fileId} (${sfcPath})`
          );
        }
        continue;
      }

      // ✅ Читаем уже готовые данные из pipeline
      const cu: ComponentUsage[] = (enhanced as any).templateComponentUsages || [];
      const he: HtmlElementUsage[] = (enhanced as any).templateHtmlElements || [];

      sfc.componentUsages = cu;
      sfc.htmlElements = he;

      allComponentUsages.push(...cu);
      allHtmlElements.push(...he);

      totalCu += cu.length;
      totalHe += he.length;

      // ============================================
      // ✅ v16.0.8: реальные имена props/emits/exposed
      // ============================================
      //
      // РАНЬШЕ: extractSFCNamesForVue вызывал parseVueFile и
      // extractSFCNames — второй парсинг <script setup>.
      //
      // ТЕПЕРЬ: имена уже извлечены в pipeline и лежат в
      // enhanced.vueAnalysis (или enhanced.templateProps и т.п.).
      //
      // Источник — analyzeVueComponent → VueComponentAnalysis.
      // ============================================
      const vueAnalysis = (enhanced as any).vueAnalysis;
      if (vueAnalysis) {
        if (Array.isArray(vueAnalysis.props?.names) && vueAnalysis.props.names.length > 0) {
          sfc.props = vueAnalysis.props.names;
        }
        if (Array.isArray(vueAnalysis.emits?.names) && vueAnalysis.emits.names.length > 0) {
          sfc.emits = vueAnalysis.emits.names;
        }
        if (Array.isArray(vueAnalysis.expose) && vueAnalysis.expose.length > 0) {
          sfc.exposed = vueAnalysis.expose;
        }
      }
    }

    if (verbose) {
      console.log('');
      console.log('   📊 Component Usage из pipeline:');
      console.log(`      SFC:              ${vue.sfc.length}`);
      console.log(`      componentUsages:  ${totalCu}`);
      console.log(`      htmlElements:     ${totalHe}`);
      if (notFoundCount > 0) {
        console.warn(`      ⚠️ SFC без данных: ${notFoundCount}`);
      }
    }
  }

  // ============================================
  // ✅ v16.0.4: top-level component*-поля из componentUsages
  // ============================================
  //
  // Теперь, когда allComponentUsages / allHtmlElements собраны
  // из pipeline (без analyzeVueSFC), заполняем top-level
  // аккумуляторы allComponentProps/Events/Directives/Slots/
  // HtmlInterpolations.
  // ============================================
  if (allComponentUsages.length > 0 || allHtmlElements.length > 0) {
    for (const cu of allComponentUsages) {
      for (const p of cu.props ?? []) {
        allComponentProps.push({
          id: p.id,
          usageId: cu.id,
          name: p.name,
          value: p.value,
          kind: p.kind,
          line: p.line,
          identifier: extractIdentifierFromValue(p.value),
          memberChain: extractMemberChainFromValue(p.value),
          literalValue: extractLiteralFromValue(p.value),
          sourceChain: p.sourceChain ?? [],
        });
      }
      for (const e of cu.events ?? []) {
        allComponentEvents.push({
          id: e.id,
          usageId: cu.id,
          eventName: e.eventName,
          handler: e.handler,
          handlerFunctionId: e.handlerFunctionId ?? null,
          handlerSource: e.handlerSource ?? 'unknown',
          modifiers: e.modifiers ?? [],
          line: e.line,
          handlerChain: e.handlerChain ?? [],
        });
      }
      for (const d of cu.directives ?? []) {
        allComponentDirectives.push({
          id: d.id,
          usageId: cu.id,
          name: d.name,
          argument: d.argument,
          modifiers: d.modifiers ?? [],
          value: d.value,
          line: d.line,
        });
      }
      for (const s of cu.slots ?? []) {
        allComponentSlots.push({
          id: s.id,
          usageId: cu.id,
          slotName: s.slotName,
          isScoped: s.isScoped,
          scopeNames: s.scopeNames ?? [],
          line: s.line,
        });
      }
    }

    for (const he of allHtmlElements) {
      for (const p of he.props ?? []) {
        allComponentProps.push({
          id: p.id,
          usageId: he.id,
          name: p.name,
          value: p.value,
          kind: p.kind,
          line: p.line,
          identifier: extractIdentifierFromValue(p.value),
          memberChain: extractMemberChainFromValue(p.value),
          literalValue: extractLiteralFromValue(p.value),
          sourceChain: p.sourceChain ?? [],
        });
      }
      for (const e of he.events ?? []) {
        allComponentEvents.push({
          id: e.id,
          usageId: he.id,
          eventName: e.eventName,
          handler: e.handler,
          handlerFunctionId: e.handlerFunctionId ?? null,
          handlerSource: e.handlerSource ?? 'unknown',
          modifiers: e.modifiers ?? [],
          line: e.line,
          handlerChain: e.handlerChain ?? [],
        });
      }
      for (const d of he.directives ?? []) {
        allComponentDirectives.push({
          id: d.id,
          usageId: he.id,
          name: d.name,
          argument: d.argument,
          modifiers: d.modifiers ?? [],
          value: d.value,
          line: d.line,
        });
      }
      for (const i of he.interpolations ?? []) {
        allHtmlInterpolations.push({
          id: i.id,
          usageId: he.id,
          expression: i.expression,
          sourceChain: i.sourceChain ?? [],
          line: i.line,
        });
      }
    }
  }

  // ============================================
  // ✅ v16.0.5: DOM API (top-level)
  // ============================================
  const domApiCalls: DomApiCall[] = [];
  const domIdCounter = { value: 0 };

  {
    const tsProject = new TsMorphProject({
      compilerOptions: {
        target: 99, module: 99, allowJs: true, checkJs: false,
        skipLibCheck: true, jsx: 2,
      },
    });

    if (verbose) {
      console.log(`   🔧 DOM API: анализ ${functions.length} функций...`);
    }

    let analyzedFns = 0;
    let skippedFns = 0;

    for (const fn of functions) {
      const sfcFile = files.find(f => f.id === fn.fileId);
      if (!sfcFile) continue;

      const absolutePath = path.resolve(projectRoot, sfcFile.path);
      if (!fs.existsSync(absolutePath)) continue;

      // ✅ v16.0.5: для Vue-файлов извлекаем <script setup> через parseVueFile
      // (а не через regex, который ломается на generic="T extends Record<string, unknown>")
      let scriptPath = absolutePath;
      if (absolutePath.endsWith('.vue')) {
        try {
          // ✅ v16.0.8: parseVueFile теперь используется ТОЛЬКО здесь
          // (в DOM API). Раньше он также вызывался в extractSFCNamesForVue.
          const parsed = parseVueFile(absolutePath);
          if (!parsed) {
            if (verbose) {
              console.warn(`   ⚠️ parseVueFile вернул null для ${sfcFile.path}`);
            }
            skippedFns++;
            continue;
          }

          const script =
            parsed.descriptor.scriptSetup?.content ||
            parsed.descriptor.script?.content ||
            '';

          if (!script.trim()) {
            if (verbose) {
              console.warn(`   ⚠️ Пустой <script> в ${sfcFile.path}`);
            }
            skippedFns++;
            continue;
          }

          scriptPath = `${absolutePath}.__dom__.ts`;
          tsProject.createSourceFile(scriptPath, script, { overwrite: true });

          if (process.env.AST_DEBUG_VUE === 'true') {
            const hasDefineProps = /\\bdefineProps\\b/.test(script);
            const hasDefineEmits = /\\bdefineEmits\\b/.test(script);
            const hasDefineExpose = /\\bdefineExpose\\b/.test(script);
            console.log(
              `   📜 ${path.basename(absolutePath)}: script ${script.length} chars, ` +
              `defineProps=${hasDefineProps}, defineEmits=${hasDefineEmits}, defineExpose=${hasDefineExpose}`
            );
          }
        } catch (err) {
          if (verbose) {
            console.warn(`   ⚠️ Не удалось извлечь script из ${sfcFile.path}: ${err}`);
          }
          skippedFns++;
          continue;
        }
      }

      try {
        const calls = detectDomApiCallsForFunction(
          fn,
          scriptPath,
          fn.fileId,
          workingEntitiesMap,
          tsProject,
          domIdCounter,
          absolutePath  // ✅ v16.0.5: передаём оригинальный путь
        );
        domApiCalls.push(...calls);
        analyzedFns++;
      } catch (err) {
        if (verbose) {
          console.warn(`   ⚠️ DOM API analysis failed for ${fn.name}: ${err}`);
        }
        skippedFns++;
      }
    }

    if (verbose) {
      console.log(`   📊 DOM API: проанализировано ${analyzedFns}, пропущено ${skippedFns}`);
      if (domApiCalls.length > 0) {
        console.log(`   🖥  DomApiCalls: ${domApiCalls.length}`);
      } else {
        console.warn(
          `   ⚠️ DOM API: 0 вызовов при ${analyzedFns} проанализированных функциях — ` +
          `проверьте isLikelyDomReceiver`
        );
      }
    }
  }

  // Заполнить fn.htmlUsage для DOM API
  for (const fn of functions) {
    const calls = domApiCalls.filter(c => c.functionId === fn.id);
    if (!fn.htmlUsage) fn.htmlUsage = [];
    for (const call of calls) {
      if (call.effect === 'read') continue;
      fn.htmlUsage.push({
        kind: 'dom-api',
        usageId: call.id,
        tag: call.target,
        target: call.method,
        line: call.line,
        column: call.column,
        domApiCategory: call.category,
        domApiMethod: call.method,
        domApiTarget: call.target,
        domApiContext: call.context,
      });
    }
    fn.isHtmlVisible = fn.htmlUsage.length > 0;
    fn.domApiCalls = calls.map(c => c.id);

    for (const call of calls) {
      if (call.category === 'add-event-listener' && call.context?.handlerFunctionId) {
        const handlerFn = functions.find(f => f.id === call.context.handlerFunctionId);
        if (handlerFn) {
          if (!handlerFn.domApiUsagesAsHandler) handlerFn.domApiUsagesAsHandler = [];
          handlerFn.domApiUsagesAsHandler.push({
            callId: call.id,
            category: call.category,
            eventName: call.context.eventName || '?',
            target: call.target,
            line: call.line,
          });
        }
      }
    }
  }

  // ============================================
  // ✅ v16.0.0: usagesAsPropSource
  // ============================================
  for (const fn of functions) {
    fn.usagesAsPropSource = [];
  }

  for (const cu of allComponentUsages) {
    for (const prop of cu.props || []) {
      const firstFnId = prop.sourceChain?.[0]?.functionId;
      if (!firstFnId) continue;

      const targetFn = functions.find(f => f.id === firstFnId);
      if (!targetFn) continue;

      if (!targetFn.usagesAsPropSource) targetFn.usagesAsPropSource = [];
      targetFn.usagesAsPropSource.push({
        usageId: cu.id,
        propId: prop.id,
        propName: prop.name,
        tag: cu.tag,
        targetFileId: cu.componentFileId,
      });
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

    totalVueSfc: vue?.sfc.length ?? 0,
    totalComposables: vue?.composables.length ?? 0,
    totalMacros: vue?.macros.length ?? 0,
    totalHooks: vue?.hooks.length ?? 0,
    totalReactivity: vue?.reactivity.length ?? 0,
    totalIcons: vue?.icons.length ?? 0,

    // ✅ v16.0.0
    totalComponentUsages: allComponentUsages.length,
    totalHtmlElements: allHtmlElements.length,
    totalComponentProps: allComponentProps.length,
    totalComponentEvents: allComponentEvents.length,
    totalDomApiCalls: domApiCalls.length,
    totalSourceChains: 0,
    totalHtmlVisibleFns: functions.filter(f => f.isHtmlVisible).length,
    totalDomApiVisibleFns: functions.filter(f => (f.domApiCalls?.length ?? 0) > 0).length,
  };

  (statistics as any).totalConditionals = totalConditionals;

  // ============================================
  // Определение корневого модуля
  // ============================================
  let root = 'm0';

  for (const file of files) {
    if (file.path.endsWith('src/index.ts') || file.path.endsWith('src\\\\index.ts')) {
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

    vue,

    // ✅ v16.0.0
    domApiCalls: domApiCalls.length > 0 ? domApiCalls : undefined,
  };

  // ✅ v16.0.4: top-level component*-поля ВСЕГДА (даже пустые []).
  (result as any).componentProps = allComponentProps;
  (result as any).componentEvents = allComponentEvents;
  (result as any).componentDirectives = allComponentDirectives;
  (result as any).componentSlots = allComponentSlots;
  (result as any).htmlInterpolations = allHtmlInterpolations;

  // ✅ v16.0.4: прокидываем те же поля в vue-секцию
  if (vue) {
    (vue as any).componentProps = allComponentProps;
    (vue as any).componentEvents = allComponentEvents;
    (vue as any).componentDirectives = allComponentDirectives;
    (vue as any).componentSlots = allComponentSlots;
    (vue as any).htmlInterpolations = allHtmlInterpolations;
  }

  // ============================================================
  // ✅ FIX v16.0.8: top-level ids и sourceChains
  // ============================================================
  // ПРОБЛЕМА:
  //   `compact.ids` заполняется в codec-encode.ts (84 записи),
  //   но `full.ids` остаётся undefined. При сравнении
  //   `decode(compact)` с `full` — расхождение:
  //     $.ids.length  a: 84  b: 0
  //
  // РЕШЕНИЕ:
  //   Собираем уникальные id из всех component*-секций
  //   в том же порядке, что и codec-encode.ts::addId.
  //
  // Симметрия:
  //   codec-decode.ts восстанавливает ids из compact.ids
  //   на top-level (симметрично).
  // ============================================================

  const allIds: string[] = [];

  for (const p of allComponentProps) {
    if (p && p.id) allIds.push(p.id);
  }
  for (const e of allComponentEvents) {
    if (e && e.id) allIds.push(e.id);
  }
  for (const d of allComponentDirectives) {
    if (d && d.id) allIds.push(d.id);
  }
  for (const s of allComponentSlots) {
    if (s && s.id) allIds.push(s.id);
  }
  for (const i of allHtmlInterpolations) {
    if (i && i.id) allIds.push(i.id);
  }

  // Дедупликация с сохранением порядка (как в codec-encode.ts::addId)
  const uniqueIds: string[] = [];
  const seenIds = new Set<string>();
  for (const id of allIds) {
    if (!seenIds.has(id)) {
      seenIds.add(id);
      uniqueIds.push(id);
    }
  }

  (result as any).ids = uniqueIds.length > 0 ? uniqueIds : undefined;

  // ============================================================
  // ✅ FIX v16.0.8: sourceChains
  // ============================================================
  // Сериализуем все sourceChain из component*-секций
  // и интернируем их (как в codec-encode.ts::addSourceChain).
  //
  // Источники:
  //   - ComponentProp.sourceChain
  //   - ComponentEvent.handlerChain
  //   - HtmlInterpolation.sourceChain
  //
  // Формат сериализации: см. serializeSourceChain()
  // в core/source-chain-resolver.ts.
  // ============================================================

  const allSourceChains: string[] = [];

  const safeSerializeChain = (chain: unknown): string | null => {
    if (!Array.isArray(chain) || chain.length === 0) return null;
    try {
      return serializeSourceChain(chain as any);
    } catch {
      return null;
    }
  };

  for (const p of allComponentProps) {
    const s = safeSerializeChain(p?.sourceChain);
    if (s) allSourceChains.push(s);
  }
  for (const e of allComponentEvents) {
    const s = safeSerializeChain(e?.handlerChain);
    if (s) allSourceChains.push(s);
  }
  for (const i of allHtmlInterpolations) {
    const s = safeSerializeChain(i?.sourceChain);
    if (s) allSourceChains.push(s);
  }

  // Интернирование (уникальные с сохранением порядка)
  const uniqueSourceChains: string[] = [];
  const seenSc = new Set<string>();
  for (const sc of allSourceChains) {
    if (!seenSc.has(sc)) {
      seenSc.add(sc);
      uniqueSourceChains.push(sc);
    }
  }

  (result as any).sourceChains =
    uniqueSourceChains.length > 0 ? uniqueSourceChains : undefined;

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

  const normalizedSource = source.replace(/\\\\/g, '/');
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
        const resolvedNormalized = resolved.replace(/\\\\/g, '/');

        const byAbs =
          sourceToFileIdMap.get(resolved) || sourceToFileIdMap.get(resolvedNormalized);
        if (byAbs) return byAbs;

        const resolvedBase = path.basename(resolved);
        const resolvedNoExt = resolvedBase.replace(/\\.[^.]+$/, '');

        const byBase = sourceToFileIdMap.get(resolvedBase);
        if (byBase) return byBase;

        const byNoExt = sourceToFileIdMap.get(resolvedNoExt);
        if (byNoExt) return byNoExt;

        for (const [fp, fd] of fileMap) {
          const fpNormalized = fp.replace(/\\\\/g, '/');
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

  if (source.startsWith('.')) {
    try {
      const fromDir = path.dirname(fromFilePath);
      const resolved = resolveFilePath(fromDir, source);
      if (resolved) {
        const resolvedNormalized = resolved.replace(/\\\\/g, '/');

        const byAbs =
          sourceToFileIdMap.get(resolved) || sourceToFileIdMap.get(resolvedNormalized);
        if (byAbs) return byAbs;

        for (const [fp, fd] of fileMap) {
          const fpNormalized = fp.replace(/\\\\/g, '/');
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
  const sourceNoExt = sourceBasename.replace(/\\.[^.]+$/, '');

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
    const escapedCallName = callName.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&');

    try {
      const cbPattern = new RegExp(
        String.raw`${escapedCallName}\\s*\\([^)]*(?:=>|function)`,
        'i'
      );
      if (cbPattern.test(body)) return 'callback';
    } catch {
      return 'direct';
    }
  }

  return 'direct';
}

// ============================================================
// ✅ v16.0.4: УТИЛИТЫ ДЛЯ РАЗБОРА ЗНАЧЕНИЙ PROPS
// ============================================================

function extractIdentifierFromValue(value: string): string | null {
  if (!value) return null;
  const m = value.match(/^([A-Za-z_$][\\w$]*)/);
  return m?.[1] ?? null;
}

function extractMemberChainFromValue(value: string): string[] | undefined {
  if (!value || !value.includes('.')) return undefined;
  const parts = value.split('.').filter(s => /^[A-Za-z_$][\\w$]*$/.test(s));
  return parts.length > 1 ? parts : undefined;
}

function extractLiteralFromValue(value: string): string | number | boolean | null | undefined {
  if (!value) return undefined;
  const t = value.trim();
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (t === 'null') return null;
  if (/^-?\\d+(\\.\\d+)?$/.test(t)) return parseFloat(t);
  if (/^['"].*['"]$/.test(t)) return t.slice(1, -1);
  return undefined;
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
