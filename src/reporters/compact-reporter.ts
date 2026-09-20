// src/reporters/compact-reporter.ts
// ============================================
// ТОНКИЙ ОРКЕСТРАТОР КОМПАКТНОГО ОТЧЁТА
// ============================================
// Версия: 14.0.0
//
// ИЗМЕНЕНИЯ v14.0.0:
//   - ✅ ДОБАВЛЕНО: `canonicalizeFullJSON` в конце `collectFullJSON` —
//     сортировка всех массивов по числовому `id` (fn1 < fn2 < ... < fn10).
//     Это гарантирует байтовое равенство
//     `encode(decode(encode(full))) === encode(full)`.
//   - ✅ ДОБАВЛЕНО: `detectCallType` распознаёт callback-рёбра
//     по суффиксу `_callback` в имени вызываемой функции.
//   - ✅ ДОБАВЛЕНЫ вспомогательные: `extractNumericId`, `sortByIdNumeric`,
//     `canonicalizeFullJSON`.
//
// ИЗМЕНЕНИЯ v13.0.0:
//   - ✅ ИСПРАВЛЕНО: ValuesMode импортируется из './codec/values-filter.js'
//     (codec-types.js его не экспортирует).
//   - ✅ ЕДИНАЯ ВЕРСИЯ: version берётся из CODEC_VERSION ('13.0.0'),
//     а не хардкодится ('11.1.0').
//   - ✅ ВАЛИДАЦИЯ toFileId: гарантируем, что после resolveToFileId
//     результат — либо `fN`, либо `external:...`, либо `unresolved:...`.
//
// ИЗМЕНЕНИЯ v11.1.0 (--values-mode):
//   - ✅ ДОБАВЛЕНО: поддержка `valuesMode: 'full' | 'relations'`.
//   - ✅ Проброс valuesMode в Codec.encode().
//
// ИЗМЕНЕНИЯ v11.0.0 (компактнее):
//   - ✅ ВЕРСИЯ отчёта: '11.0.0'.
//   - ✅ fns/cls/cn: name → nameIdx (stringDict), flags → число.
//
// ИЗМЕНЕНИЯ v10.4.0 (единое сжатие + легенда для ИИ):
//   - ✅ ДОБАВЛЕНО: единая функция `saveJsonFile`.
//
// ИЗМЕНЕНИЯ v9.0.7 (fix: разделение файлов compact/full):
//   - ✅ ИСПРАВЛЕНО: функция `insertSuffixBeforeExtension`.
//
// ИЗМЕНЕНИЯ v9.0.6 (safe-json fix):
//   - ✅ ДОБАВЛЕНО: импорт safeJsonStringify.
//
// ИЗМЕНЕНИЯ v9.0.5:
//   - ✅ ДОБАВЛЕНО: опция `saveEdges` (по умолчанию false).
//
// ИЗМЕНЕНИЯ v10.3 (L1/L2/DL fix):
//   - ✅ ВСЕГДА массивы для базовых секций.
//   - ✅ type-only импорты пишутся как `type: 'type'`.
//   - ✅ `templates[].conditionals[]` обогащаются полями `id` и `fileId`.
//
// ИЗМЕНЕНИЯ v9.0.2:
//   - ✅ ИСПРАВЛЕНО: templates.push({...}) — ровно 12 полей TemplateData.
//   - ✅ ИСПРАВЛЕНО: пустые секции → undefined.
//
// ИЗМЕНЕНИЯ v9.0.0:
//   - ✅ УДАЛЕНЫ локальные определения GenerateReportOptions/Result.
// ============================================

import fs from 'fs';
import path from 'path';
import { Project } from 'ts-morph';
import type { EntitiesResult, FunctionInfo } from '../types.js';
import { Codec } from './codec/codec.js';
import { isExternalModule, resolveFilePath } from '../core/ast-parser.js';
import {
  loadTsConfig,
  resolveAliasPath,
  getTsConfigDir,
  clearTsConfigCache,
} from '../core/tsconfig-resolver.js';
import { enrichWithReExports } from '../core/entity-extractor/enrich-with-re-exports.js';

// ✅ v9.0.6: безопасная сериализация (BigInt, Map, Set, Circular)
import { safeJsonStringify } from '../utils/safe-json.js';

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
} from './codec/codec-types.js';

// ✅ v13.0.0-fix: единая версия CODEC
import { CODEC_VERSION } from './codec/codec-types.js';

// ✅ v13.0.0-fix: ValuesMode импортируется из values-filter.js
import type { ValuesMode } from './codec/values-filter.js';

// ============================================
// ✅ v9.0.0: РЕЭКСПОРТ ТИПОВ (для обратной совместимости)
// ============================================
export type {
  GenerateReportOptions,
  GenerateReportResult,
} from './codec/codec-types.js';

// ✅ v13.0.0-fix: ValuesMode реэкспортируется из values-filter.js
export type { ValuesMode } from './codec/values-filter.js';

// ============================================
// ✅ v11.1.0: КОНСТАНТЫ РЕЖИМА VALUES
// ============================================

/**
 * Значение по умолчанию для `valuesMode`.
 */
const DEFAULT_VALUES_MODE: ValuesMode = 'relations';

/**
 * Пороговые значения для классификации `value` как «тяжёлого».
 */
const HEAVY_VALUE_THRESHOLDS = {
  /** Строки длиннее этого — 'template' (HTML/CSS/код) */
  STRING_LENGTH: 200,
  /** Массивы длиннее этого — 'flag-array' */
  ARRAY_LENGTH: 50,
  /** Объекты с JSON.stringify длиннее этого — 'config' */
  OBJECT_JSON_LENGTH: 500,
} as const;

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
    console.log(`   🎯 Conditionals: ${full.conditionals?.length || 0}`);
    console.log(`   🧬 Lifecycle: ${full.lifecycle?.length || 0}`);
    console.log(`   ⚡ Effects: ${full.effects?.length || 0}`);
    console.log(`   💉 Injections: ${full.injections?.length || 0}`);
    console.log(`   🔄 Reactivity: ${full.reactivity?.length || 0}`);
    console.log(`   📐 Types: ${full.types?.length || 0}`);
    console.log(`   🔗 TypeRefs: ${full.typeRefs?.length || 0}`);

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

      // ✅ v11.1.0: диагностика размера values
      const valuesCount = compact.values?.length ?? 0;
      console.log(`   📦 values[]: ${valuesCount} элементов`);

      // ✅ v9.0.2: диагностика vt-секции
      if (process.env.AST_DEBUG_CODEC === 'true' && compact.vt) {
        for (let i = 0; i < compact.vt.length; i++) {
          const vt = compact.vt[i];
          if (vt && vt.length !== 12) {
            console.warn(`   ⚠️ vt[${i}] содержит ${vt.length} полей вместо 12`);
          }
        }
      }
    }
  }

  // ============================================
  // ШАГ 4: Сохранение файлов (через единый saveJsonFile)
  // ============================================
  let compactPath: string | undefined;
  let fullPath: string | undefined;
  let edgesPath: string | undefined;
  let compactSize: number | undefined;
  let fullSize: number | undefined;
  let edgesSize: number | undefined;
  let compressionRatio: number | undefined;

  if (outputPath) {
    // ✅ v9.0.7: заранее вычисляем путь к full-файлу
    let fullPathResolved: string | undefined;
    if (saveFull) {
      fullPathResolved = insertSuffixBeforeExtension(outputPath, fullSuffix);

      // ✅ v9.0.7: защита от коллизии
      if (path.resolve(fullPathResolved) === path.resolve(outputPath)) {
        console.warn(
          `   ⚠️  [compact-reporter] fullPath совпал с compactPath, ` +
          `применяю аварийный суффикс: ${outputPath}`
        );
        fullPathResolved = insertUniqueSuffix(outputPath, fullSuffix);
      }
    }

    // ---- Сохраняем сжатый JSON (основной) ----
    if (compact) {
      const saved = saveJsonFile(outputPath, compact, 'Сжатый JSON', verbose);
      compactPath = saved.path;
      compactSize = saved.size;
    }

    // ---- Сохраняем полный JSON (для отладки) ----
    if (saveFull && fullPathResolved) {
      const saved = saveJsonFile(fullPathResolved, full, 'Полный JSON', verbose);
      fullPath = saved.path;
      fullSize = saved.size;

      // ✅ v9.0.7: финальная проверка
      if (compactPath && path.resolve(compactPath) === path.resolve(fullPath)) {
        console.error(
          `   ❌ [compact-reporter] КРИТИЧЕСКАЯ ОШИБКА: ` +
          `compactPath и fullPath совпадают: ${compactPath}`
        );
      }
    }

    // ---- Сохраняем edges в отдельный файл (только если saveEdges: true) ----
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

    // ---- Считаем коэффициент сжатия ----
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
    edgesPath, // ✅ v9.0.4
    stats: {
      duration,
      compactSize,
      fullSize,
      edgesSize, // ✅ v9.0.4
      compressionRatio,
      valuesMode, // ✅ v11.1.0
      valuesCount: compact?.values?.length ?? 0, // ✅ v11.1.0
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

  // ✅ v11.1.0: пробрасываем valuesMode из compact в decode
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

  fs.writeFileSync(filePath, safeJsonStringify(data), 'utf-8');
  const size = fs.statSync(filePath).size;

  if (verbose) {
    const sizeKB = (size / 1024).toFixed(2);
    console.log(`   💾 ${label}: ${filePath} (${sizeKB} KB)`);
  }

  return { path: filePath, size };
}

// ============================================
// ✅ v14.0.0: КАНОНИЗАЦИЯ FULLJSON
// ============================================
//
// Сортировка всех массивов по числовому `id` (fn1 < fn2 < ... < fn10).
//
// ⚠️ Это НЕ строковая сортировка (`'fn1' < 'fn10' < 'fn2'`) —
// она ломала round-trip в v13.0.1. Здесь числовая.
//
// `decode` восстанавливает `id` из позиции (`functions[i].id = 'fn${i+1}'`).
// Если `encode` пишет массивы в каноническом порядке, то `decode`
// восстанавливает их в том же порядке → байтовое равенство.
// ============================================

/**
 * Извлекает числовой суффикс из `id` (`fn123` → 123).
 * Не-числовой суффикс → `Infinity` (уходит в конец).
 */
function extractNumericId(id: string | undefined): number {
  if (!id) return Infinity;
  const match = id.match(/(\d+)$/);
  const suffix = match?.[1];
  return suffix ? parseInt(suffix, 10) : Infinity;
}

/**
 * Сортирует массив по числовому `id`. Не мутирует исходный массив.
 */
function sortByIdNumeric<T extends { id?: string }>(arr: T[] | undefined): T[] {
  if (!arr) return [];
  return [...arr].sort((a, b) => {
    const na = extractNumericId(a.id);
    const nb = extractNumericId(b.id);
    if (na !== nb) return na - nb;
    return (a.id ?? '').localeCompare(b.id ?? '');
  });
}

/**
 * Канонизирует `FullJSON`:
 *   - сортирует `modules`, `files`, `functions`, `classes`, `constants`,
 *     `exports`, `imports`, `calls`, `reExports` по числовому `id`;
 *   - не трогает `id` внутри элементов;
 *   - не трогает вложенные массивы (`fileIds`, `methods` и т.п.).
 */
function canonicalizeFullJSON(payload: FullJSON): FullJSON {
  return {
    ...payload,
    modules: sortByIdNumeric(payload.modules),
    files: sortByIdNumeric(payload.files),
    functions: sortByIdNumeric(payload.functions),
    classes: sortByIdNumeric(payload.classes),
    constants: sortByIdNumeric(payload.constants),
    exports: sortByIdNumeric(payload.exports),
    imports: sortByIdNumeric(payload.imports),
    calls: sortByIdNumeric(payload.calls),
    reExports: sortByIdNumeric(payload.reExports),
  };
}

// ============================================
// СБОР ПОЛНОГО JSON (ВНУТРЕННЯЯ ФУНКЦИЯ)
// ============================================

/**
 * Собирает полный JSON из карты сущностей.
 *
 * ✅ v14.0.0: в конце вызывается `canonicalizeFullJSON` — все массивы
 * сортируются по числовому `id`. Это гарантирует детерминированный
 * порядок независимо от порядка обхода `entitiesMap`.
 *
 * ✅ v13.0.0: version = CODEC_VERSION; валидация toFileId.
 * ✅ v11.1.0: version = '11.1.0'; valuesMode пробрасывается.
 * ✅ v11.0.0: version = '11.0.0'.
 * ✅ v10.3: базовые секции ВСЕГДА массивы.
 * ✅ v9.0.2: templates.push содержит ровно 12 полей TemplateData.
 * ✅ v9.0.0: собираются секции conditionals[], lifecycle[], effects[],
 *            injections[], reactivity[], types[], typeRefs[].
 */
function collectFullJSON(
  entitiesMap: Record<string, EntitiesResult>,
  verbose: boolean = false,
  valuesMode: ValuesMode = DEFAULT_VALUES_MODE
): FullJSON {
  // ============================================
  // ✅ v8.5.0: Инициализация tsconfig
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

  // ============================================
  // 🆕 ОБОГАЩЕНИЕ RE-EXPORTS
  // ============================================
  let workingEntitiesMap = entitiesMap;

  try {
    const tsProject = new Project({
      compilerOptions: {
        target: 99,
        module: 99,
        allowJs: true,
        checkJs: false,
        skipLibCheck: true,
        jsx: 2,
      },
      useInMemoryFileSystem: false,
    });

    let addedFiles = 0;
    for (const filePath of Object.keys(entitiesMap)) {
      try {
        const absPath = path.resolve(filePath);
        if (fs.existsSync(absPath)) {
          tsProject.addSourceFileAtPath(absPath);
          addedFiles++;
        }
      } catch {
        // Игнорируем ошибки отдельных файлов
      }
    }

    if (addedFiles > 0) {
      const enrichResult = enrichWithReExports(tsProject, entitiesMap, {
        maxDepth: 10,
        projectRoot: process.cwd(),
        debug: verbose,
      });

      workingEntitiesMap = enrichResult.enrichedEntities as Record<string, EntitiesResult>;

      if (verbose) {
        console.log(`   🔄 Re-exports развёрнуто: ${enrichResult.stats.expandedChains}`);
        console.log(`   📁 Файлов с re-exports: ${enrichResult.stats.filesWithReExports}`);
        console.log(`   📏 Макс. глубина цепочки: ${enrichResult.stats.maxDepth}`);
      }
    }
  } catch (error) {
    if (verbose) {
      console.warn(
        `   ⚠️ Re-exports не развёрнуты: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    workingEntitiesMap = entitiesMap;
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
  const conditionals: TemplateConditional[] = [];

  // ✅ v9.0.0: новые секции
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
  // ✅ v8.4.2: массив функций для каждого имени (дубли не теряются)
  const functionMap = new Map<string, FunctionData[]>();

  // ✅ v8.5.0: карта source → fileId
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

  // ✅ v9.0.0: счётчики новых секций
  let lifecycleCounter = 0;
  let effectCounter = 0;
  let injectionCounter = 0;
  let reactivityCounter = 0;
  let typeCounter = 0;
  let typeRefCounter = 0;

  // ============================================
  // ПЕРВЫЙ ПРОХОД: модули, файлы, функции, классы, константы
  // ============================================
  for (const [filePath, entities] of Object.entries(workingEntitiesMap)) {
    if (!entities) continue;

    // Модуль = директория файла
    const dirName = path.basename(path.dirname(filePath)) || 'root';
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

    // Файл
    let file = fileMap.get(filePath);

    if (!file) {
      fileCounter++;
      file = {
        id: `f${fileCounter}`,
        path: filePath,
        moduleId: module.id,
      };
      fileMap.set(filePath, file);
      files.push(file);
      // ✅ ЗАПОЛНЯЕМ fileIds модуля
      module.fileIds.push(file.id);
    }

    // ✅ v8.5.0: регистрируем МНОГО вариантов пути
    const absolutePath = path.resolve(filePath);
    const normalizedPath = filePath.replace(/\\/g, '/');
    const normalizedAbs = absolutePath.replace(/\\/g, '/');

    sourceToFileIdMap.set(filePath, file.id);
    sourceToFileIdMap.set(normalizedPath, file.id);
    sourceToFileIdMap.set(absolutePath, file.id);
    sourceToFileIdMap.set(normalizedAbs, file.id);
    sourceToFileIdMap.set(path.basename(filePath), file.id);
    const baseNoExt = path.basename(filePath).replace(/\.[^.]+$/, '');
    sourceToFileIdMap.set(baseNoExt, file.id);
    const relFromCwd = path.relative(process.cwd(), absolutePath).replace(/\\/g, '/');
    sourceToFileIdMap.set(relFromCwd, file.id);
    sourceToFileIdMap.set(relFromCwd.replace(/\.[^.]+$/, ''), file.id);

    // Функции
    const funcs = entities.functions || [];
    for (const func of funcs) {
      if (!func || !func.name) continue;

      functionCounter++;
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
      };

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

      // ✅ v11.1.0: в режиме relations тяжёлые значения не сохраняем.
      const valueToStore = shouldKeepValue(cn.value, valuesMode) ? cn.value : undefined;

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
  // ✅ v8.4.0 + v9.0.0 + v9.0.2 + v10.3: сбор Vue-шаблонов и conditionals
  // ============================================
  for (const [filePath, entities] of Object.entries(workingEntitiesMap)) {
    if (!entities) continue;
    if (!filePath.endsWith('.vue')) continue;

    const dirName = path.basename(path.dirname(filePath)) || 'root';
    const module = moduleMap.get(dirName);
    const file = fileMap.get(filePath);
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

    // ✅ v10.3: обогащаем conditionals полями id и fileId
    const fileConditionals = e.templateConditionals || [];
    const enrichedConditionals: TemplateConditional[] = fileConditionals.map((cd: any) => {
      conditionalCounter++;
      const enriched: TemplateConditional = {
        id: `cd${conditionalCounter}`,
        directive: cd.directive,
        fileId: file.id,
        line: cd.line,
        conditionExpression: cd.conditionExpression,
        renderedComponent: cd.renderedComponent,
      };
      conditionals.push(enriched);
      return enriched;
    });

    // ✅ v9.0.2 + v10.3: гарантируем РОВНО 12 полей TemplateData.
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
    console.log(`   🎯 Conditionals: ${conditionals.length}`);

    if (process.env.AST_DEBUG_CODEC === 'true') {
      for (let i = 0; i < templates.length; i++) {
        const t = templates[i];
        if (t) {
          const fieldCount = Object.keys(t).length;
          if (fieldCount !== 12) {
            console.warn(`   ⚠️ templates[${i}] содержит ${fieldCount} полей вместо 12`);
          }
        }
      }
    }
  }

  // ============================================
  // ВТОРОЙ ПРОХОД: экспорты, импорты, вызовы, реэкспорты
  // ============================================
  for (const [filePath, entities] of Object.entries(workingEntitiesMap)) {
    if (!entities) continue;

    const dirName = path.basename(path.dirname(filePath)) || 'root';
    const module = moduleMap.get(dirName);
    const file = fileMap.get(filePath);

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
        // ----- РЕЭКСПОРТ -----
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

      // ----- ОБЫЧНЫЙ ЭКСПОРТ -----
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

      const isExternal = (imp as any).isExternal ?? isExternalModule(imp.source, filePath);

      const packageName = isExternal
        ? (imp as any).packageName ||
        (imp.source.startsWith('@')
          ? imp.source.split('/').slice(0, 2).join('/')
          : imp.source.split('/')[0])
        : undefined;

      let resolvedToFileId: string | null = null;

      if (isExternal) {
        resolvedToFileId = `external:${packageName || imp.source}`;
      } else {
        resolvedToFileId = resolveToFileId(imp.source, filePath, sourceToFileIdMap, fileMap);
        if (!resolvedToFileId) {
          resolvedToFileId = (imp as any).toFileId || `unresolved:${imp.source}`;
        }
      }

      // ✅ v13.0.0-fix: гарантируем, что toFileId — либо `fN`,
      // либо `external:...`, либо `unresolved:...`.
      if (
        resolvedToFileId &&
        !/^f\d+$/.test(resolvedToFileId) &&
        !resolvedToFileId.startsWith('external:') &&
        !resolvedToFileId.startsWith('unresolved:')
      ) {
        resolvedToFileId = `unresolved:${imp.source}`;
      }

      const impLine = imp.loc?.start?.line ?? (imp as any).line ?? 0;

      if (specifiersStructured.length > 0) {
        for (const spec of specifiersStructured) {
          if (!spec || !spec.imported || !spec.local) continue;

          importCounter++;

          const baseType = getImportTypeFromSpecifierType(spec.type);
          const importType: 'named' | 'default' | 'namespace' | 'type' = imp.isTypeOnly
            ? 'type'
            : baseType;

          imports.push({
            id: `i${importCounter}`,
            fromFileId: file.id,
            toFileId: resolvedToFileId,
            source: imp.source,
            importedName: spec.imported,
            localName: spec.local,
            line: impLine,
            type: importType,
            isDefault: spec.type === 'ImportDefaultSpecifier',
            isNamespace: spec.type === 'ImportNamespaceSpecifier',
            isTypeOnly: imp.isTypeOnly || false,
            isExternal,
            packageName,
          });
        }
      } else {
        for (const spec of specifiers as unknown[]) {
          let importedName = '';
          let localName = '';
          let importType: 'named' | 'default' | 'namespace' | 'type' = 'named';
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
            }
          }

          if (!importedName || !localName) continue;

          importCounter++;

          const finalType: 'named' | 'default' | 'namespace' | 'type' = imp.isTypeOnly
            ? 'type'
            : importType;

          imports.push({
            id: `i${importCounter}`,
            fromFileId: file.id,
            toFileId: resolvedToFileId,
            source: imp.source,
            importedName,
            localName,
            line: impLine,
            type: finalType,
            isDefault,
            isNamespace,
            isTypeOnly: imp.isTypeOnly || false,
            isExternal,
            packageName,
          });
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

        if (!toFunc) {
          callCounter++;
          calls.push({
            id: `c${callCounter}`,
            fromFunctionId: fromFunc.id,
            toFunctionId: `external:${callName}`,
            line: func.line || 0,
            type: callType,
          });
          continue;
        }

        if (fromFunc.id === toFunc.id) continue;

        callCounter++;
        calls.push({
          id: `c${callCounter}`,
          fromFunctionId: fromFunc.id,
          toFunctionId: toFunc.id,
          line: func.line || 0,
          type: callType,
        });
      }
    }
  }

  if (verbose) {
    console.log(
      `   ✅ Второй проход: ${exports.length} экспортов, ${reExports.length} реэкспортов, ${calls.length} вызовов, ${imports.length} импортов`
    );
  }

  // ============================================
  // ✅ v9.0.0: СБОР НОВЫХ СЕКЦИЙ
  // ============================================
  for (const [filePath, entities] of Object.entries(workingEntitiesMap)) {
    if (!entities) continue;

    const dirName = path.basename(path.dirname(filePath)) || 'root';
    const module = moduleMap.get(dirName);
    const file = fileMap.get(filePath);
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
    lifecycle.length +
    effects.length +
    injections.length +
    reactivity.length +
    types.length +
    typeRefs.length >
    0
  ) {
    console.log(`   🧬 Lifecycle: ${lifecycle.length}`);
    console.log(`   ⚡ Effects: ${effects.length}`);
    console.log(`   💉 Injections: ${injections.length}`);
    console.log(`   🔄 Reactivity: ${reactivity.length}`);
    console.log(`   📐 Types: ${types.length}`);
    console.log(`   🔗 TypeRefs: ${typeRefs.length}`);
  }

  // ============================================
  // Статистика
  // ============================================
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
  };

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
  // ✅ v13.0.0: version = CODEC_VERSION — единая константа.
  const result: FullJSON = {
    version: CODEC_VERSION,
    timestamp: new Date().toISOString(),
    root,
    valuesMode, // ✅ v11.1.0
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
    conditionals: conditionals.length > 0 ? conditionals : undefined,
    lifecycle: lifecycle.length > 0 ? lifecycle : undefined,
    effects: effects.length > 0 ? effects : undefined,
    injections: injections.length > 0 ? injections : undefined,
    reactivity: reactivity.length > 0 ? reactivity : undefined,
    types: types.length > 0 ? types : undefined,
    typeRefs: typeRefs.length > 0 ? typeRefs : undefined,
  };

  // ============================================
  // ✅ v14.0.0: КАНОНИЗАЦИЯ
  // ============================================
  // Сортируем все массивы по ЧИСЛОВОМУ `id`. Это гарантирует,
  // что `full.json` детерминирован независимо от порядка обхода
  // `entitiesMap`.
  //
  // Без этого `encode(decode(encode(x)))` может дать другой порядок
  // в `strs` / `params` / `values`, и байтовое равенство сломается.
  // ============================================
  return canonicalizeFullJSON(result);
}

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

/**
 * ✅ v9.0.7: вставляет суффикс перед расширением файла.
 */
function insertSuffixBeforeExtension(filePath: string, suffix: string): string {
  const ext = path.extname(filePath); // '.json'
  const base = filePath.slice(0, -ext.length); // 'report'

  // Нормализуем суффикс: убеждаемся, что он начинается с точки
  let normalizedSuffix = suffix.trim();
  if (!normalizedSuffix) {
    return insertUniqueSuffix(filePath, suffix);
  }
  if (!normalizedSuffix.startsWith('.')) {
    normalizedSuffix = `.${normalizedSuffix}`;
  }

  // Если суффикс заканчивается на то же расширение, что и файл,
  // убираем расширение из суффикса — оно уже есть в ext.
  let suffixWithoutExt = normalizedSuffix;
  if (suffixWithoutExt.endsWith(ext) && ext.length > 0) {
    suffixWithoutExt = suffixWithoutExt.slice(0, -ext.length);
  }

  // Собираем итоговый путь
  const result = `${base}${suffixWithoutExt}${ext}`;

  // Защита: если результат совпал с исходным
  if (path.resolve(result) === path.resolve(filePath)) {
    return insertUniqueSuffix(filePath, suffix);
  }

  return result;
}

/**
 * ✅ v9.0.7: аварийная функция — добавляет числовой суффикс,
 * пока результат не станет уникальным относительно исходного пути.
 */
function insertUniqueSuffix(filePath: string, suffix: string): string {
  const ext = path.extname(filePath); // '.json'
  const base = filePath.slice(0, -ext.length); // 'report'

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

/**
 * ✅ v8.5.0: resolveToFileId с полной интеграцией tsconfig.
 */
function resolveToFileId(
  source: string,
  fromFilePath: string,
  sourceToFileIdMap: Map<string, string>,
  fileMap: Map<string, FileData>
): string | null {
  // 1. Прямой поиск в карте
  const direct = sourceToFileIdMap.get(source);
  if (direct) return direct;

  const normalizedSource = source.replace(/\\/g, '/');
  const directNormalized = sourceToFileIdMap.get(normalizedSource);
  if (directNormalized) return directNormalized;

  // 2. Алиасы через tsconfig
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

  // 3. Относительные пути через resolveFilePath
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

  // 4. Поиск по basename
  const sourceBasename = path.basename(source);
  const sourceNoExt = sourceBasename.replace(/\.[^.]+$/, '');

  const byBasename = sourceToFileIdMap.get(sourceBasename);
  if (byBasename) return byBasename;

  const byNoExt = sourceToFileIdMap.get(sourceNoExt);
  if (byNoExt) return byNoExt;

  // 5. Внешний пакет
  if (!source.startsWith('.')) {
    const pkg = source.startsWith('@')
      ? source.split('/').slice(0, 2).join('/')
      : source.split('/')[0];
    if (pkg) return `external:${pkg}`;
  }

  return null;
}

/**
 * Определяет тип импорта по типу specifier.
 */
function getImportTypeFromSpecifierType(
  specifierType: string
): 'named' | 'default' | 'namespace' | 'type' {
  switch (specifierType) {
    case 'ImportDefaultSpecifier':
      return 'default';
    case 'ImportNamespaceSpecifier':
      return 'namespace';
    case 'ImportSpecifier':
    default:
      return 'named';
  }
}

/**
 * Определяет тип вызова по контексту.
 *
 * ✅ v14.0.0: добавлена явная проверка `_callback` в имени —
 * это самый надёжный признак callback-ребра, сгенерированного
 * в `extract-entities-from-ast.ts` через `inferFunctionName`.
 */
function detectCallType(
  func: FunctionInfo,
  callName: string
): 'direct' | 'async' | 'method' | 'callback' {
  if (func.isAsync) return 'async';

  // ✅ v14.0.0: callback-рёбра имеют суффикс `_callback`
  if (callName.endsWith('_callback')) return 'callback';

  if (callName.includes('.')) return 'method';

  const body = func.body || '';
  if (body) {
    const escapedCallName = callName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    try {
      const cbPattern = new RegExp(String.raw`${escapedCallName}\s*\([^)]*(?:=>|function)`, 'i');
      if (cbPattern.test(body)) return 'callback';
    } catch {
      return 'direct';
    }
  }

  return 'direct';
}

// ============================================
// ✅ v11.1.0: КЛАССИФИКАЦИЯ ЗНАЧЕНИЙ
// ============================================

/**
 * Определяет, нужно ли сохранять значение в `full.constants[].value`.
 */
function shouldKeepValue(value: unknown, mode: ValuesMode): boolean {
  if (mode === 'full') return true;
  if (value === undefined || value === null) return true;

  if (typeof value === 'string') {
    return value.length <= HEAVY_VALUE_THRESHOLDS.STRING_LENGTH;
  }

  if (Array.isArray(value)) {
    return value.length <= HEAVY_VALUE_THRESHOLDS.ARRAY_LENGTH;
  }

  if (typeof value === 'object') {
    try {
      const json = JSON.stringify(value);
      return json.length <= HEAVY_VALUE_THRESHOLDS.OBJECT_JSON_LENGTH;
    } catch {
      return false;
    }
  }

  return true;
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
