// src/reporters/compact-reporter.ts
// ============================================
// ТОНКИЙ ОРКЕСТРАТОР КОМПАКТНОГО ОТЧЁТА
// ============================================
// Версия: 15.0.7
//
// ИЗМЕНЕНИЯ v15.0.7 (fix isExternal ↔ toFileId desync):
//   - ✅ ИСПРАВЛЕНО: `isExternal`/`isUnresolved` теперь ПРОИЗВОДНЫЕ
//     от `resolvedToFileId`, а не вычисляются отдельно. Это
//     устраняет рассинхрон для Vue-алиасов (`@/components/ui`):
//       • Раньше: toFileId="external:@/components", isExternal=false
//       • Теперь: toFileId="unresolved:@/components/ui", isExternal=false
//   - ✅ ИСПРАВЛЕНО: `resolveToFileId` больше НЕ превращает
//     алиасы `@/`, `~/`, `#/` в `external:*`. Раньше они
//     ошибочно классифицировались как scoped-пакеты.
//   - ✅ Версия: 15.0.6 → 15.0.7.
//
// ИЗМЕНЕНИЯ v15.0.6 (isExternal — производное от imp.toFileId):
//   - ✅ ИСПРАВЛЕНО: `isExternal` теперь определяется по префиксу
//     `imp.toFileId` (из AST), а НЕ пересчитывается через
//     `isExternalModule`. Это устраняет рассинхрон для Vue-алиасов
//     (`@/components/ui`): AST уже вычислил `toFileId = "external:@/components"`,
//     и `compact-reporter` должен это уважать, а не пересчитывать.
//   - ✅ ДОБАВЛЕНО: переменная `isUnresolved` — для префикса `unresolved:`.
//   - ✅ Ветки isExternal/isUnresolved/локальный используют `toFileId`
//     из AST как источник истины.
//   - ✅ Версия: 15.0.4 → 15.0.6.
//
// ИЗМЕНЕНИЯ v15.0.4 (заполнение importedName/localName + реэкспорты):
//   - ✅ ИСПРАВЛЕНО: `collectFullJSON` теперь заполняет
//     `importedName` и `localName` для ВСЕХ импортов, включая
//     реэкспорты. Раньше при пустых specifiers импорт молча
//     пропускался, из-за чего в UI не отображались связи.
//   - ✅ ДОБАВЛЕНО: обработка реэкспортов без specifiers
//     (`export * from './foo'`) — создаётся запись в imports[]
//     с `importedName: '*'`, `localName: '*'`, `isReExport: true`,
//     `isStarReExport: true`.
//   - ✅ ДОБАВЛЕНО: проброс `isReExport` и `isStarReExport` из
//     `imp` в `ImportData`.
//   - ✅ ИСПРАВЛЕНО: fallback-имена для spec.imported/spec.local.
//   - ✅ ДОБАВЛЕНО: диагностика в verbose-режиме — сколько
//     импортов с пустыми именами было исправлено.
//
// ИЗМЕНЕНИЯ v15.0.3 (нормализация путей в отчёте):
//   - ✅ ИСПРАВЛЕНО: `FullJSON.files[].path` теперь ВСЕГДА
//     относительный от `process.cwd()`, а не абсолютный.
//
// ИЗМЕНЕНИЯ v15.0.2 (устранение дублирования conditionals):
//   - ✅ УБРАНО дублирование `conditionals`.
//
// ИЗМЕНЕНИЯ v15.0.1 (fix imports[].type):
//   - ✅ ИСПРАВЛЕНО: `imports[].type` теперь ВСЕГДА принимает
//     только 'named' | 'default' | 'namespace'.
//
// ИЗМЕНЕНИЯ v15.0.0 (расширенные секции + isTypeOnly):
//   - ✅ ИСПРАВЛЕНО: `collectFullJSON` при построении ImportData
//     больше НЕ перетирает `type` значением `'type'`.
//
// ИЗМЕНЕНИЯ v14.0.0:
//   - ✅ ДОБАВЛЕНО: `canonicalizeFullJSON` в конце `collectFullJSON`.
//
// ИЗМЕНЕНИЯ v13.0.0:
//   - ✅ ИСПРАВЛЕНО: ValuesMode импортируется из './codec/values-filter.js'.
//   - ✅ ЕДИНАЯ ВЕРСИЯ: version берётся из CODEC_VERSION.
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
export type { GenerateReportOptions, GenerateReportResult } from './codec/codec-types.js';

// ✅ v13.0.0-fix: ValuesMode реэкспортируется из values-filter.js
export type { ValuesMode } from './codec/values-filter.js';

// ============================================
// КОНСТАНТЫ
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
    console.log(`   🎯 Conditionals: ${countConditionals(full)}`);
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

    // ✅ v15.0.4: диагностика пустых имён
    const emptyNameImports = (full.imports || []).filter(
      imp => !imp.importedName && !imp.localName
    );
    if (emptyNameImports.length > 0) {
      console.log(`   ⚠️  Импортов с пустыми именами: ${emptyNameImports.length}`);
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
// СБОР ПОЛНОГО JSON (ВНУТРЕННЯЯ ФУНКЦИЯ)
// ============================================

/**
 * Собирает полный JSON из карты сущностей.
 *
 * ✅ v15.0.7: isExternal/isUnresolved — производные от resolvedToFileId.
 * ✅ v15.0.6: isExternal — производное от imp.toFileId.
 * ✅ v15.0.4: fill importedName/localName, обрабатывает реэкспорты.
 * ✅ v15.0.3: все пути нормализуются в ОТНОСИТЕЛЬНЫЕ от `process.cwd()`.
 * ✅ v15.0.2: conditionals живут ТОЛЬКО в `templates[].conditionals`.
 * ✅ v15.0.1: `imports[].type` теперь ВСЕГДА принимает только
 *   `'named' | 'default' | 'namespace'`.
 * ✅ v15.0.0: не перетирает `type` значением `'type'`.
 * ✅ v14.0.0: в конце вызывается `canonicalizeFullJSON`.
 * ✅ v13.0.0: version = CODEC_VERSION; валидация toFileId.
 * ✅ v11.1.0: valuesMode пробрасывается.
 * ✅ v10.3: базовые секции ВСЕГДА массивы.
 * ✅ v9.0.2: templates.push содержит ровно 12 полей TemplateData.
 */
function collectFullJSON(
  entitiesMap: Record<string, EntitiesResult>,
  verbose: boolean = false,
  valuesMode: ValuesMode = DEFAULT_VALUES_MODE
): FullJSON {
  // ============================================
  // ✅ v15.0.3: projectRoot для нормализации путей
  // ============================================
  const projectRoot = process.cwd();

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
  // ✅ v15.0.4: workingEntitiesMap = entitiesMap (без обогащения)
  // ============================================
  // Раньше здесь был блок enrichWithReExports, который разворачивал
  // реэкспорты. Теперь это делается на этапе EnrichReExportsStage в pipeline.
  const workingEntitiesMap = entitiesMap;

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

  // ✅ v15.0.4: счётчик для диагностики
  let emptyNameFixCount = 0;

  // ============================================
  // ПЕРВЫЙ ПРОХОД: модули, файлы, функции, классы, константы
  // ============================================
  for (const [filePath, entities] of Object.entries(workingEntitiesMap)) {
    if (!entities) continue;

    // ✅ v15.0.3: НОРМАЛИЗАЦИЯ ПУТИ
    const absolutePath = path.resolve(filePath);
    const relativePath = path
      .relative(projectRoot, absolutePath)
      .replace(/\\/g, '/');

    // Модуль = директория файла
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

    // Файл
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
      // ✅ ЗАПОЛНЯЕМ fileIds модуля
      module.fileIds.push(file.id);
    }

    // ✅ v8.5.0: регистрируем МНОГО вариантов пути
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
  // ✅ v8.4.0 + v15.0.2 + v15.0.3: сбор Vue-шаблонов
  // ============================================
  for (const [filePath, entities] of Object.entries(workingEntitiesMap)) {
    if (!entities) continue;
    if (!filePath.endsWith('.vue')) continue;

    const absolutePath = path.resolve(filePath);
    const relativePath = path
      .relative(projectRoot, absolutePath)
      .replace(/\\/g, '/');

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

    // ✅ v15.0.2: conditionals с id/fileId
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
    console.log(`   🎯 Conditionals: ${countConditionals({ templates } as FullJSON)}`);
  }

  // ============================================
  // ВТОРОЙ ПРОХОД: экспорты, импорты, вызовы, реэкспорты
  // ============================================
  for (const [filePath, entities] of Object.entries(workingEntitiesMap)) {
    if (!entities) continue;

    // ✅ v15.0.3: нормализация пути
    const absolutePath = path.resolve(filePath);
    const relativePath = path
      .relative(projectRoot, absolutePath)
      .replace(/\\/g, '/');

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
    // ✅ v15.0.7: ИМПОРТЫ (isExternal — производное от resolvedToFileId)
    // --------------------------------------------
    const importsList = entities.imports || [];

    for (const imp of importsList) {
      if (!imp || !imp.source) continue;

      const specifiersStructured = (imp as any).specifiersStructured || [];
      const specifiers = imp.specifiers || [];
      const isReExport = (imp as any).isReExport === true;
      const isStarReExport = (imp as any).isStarReExport === true;

      // ============================================
      // ✅ v15.0.7-fix: ЕДИНЫЙ ИСТОЧНИК ИСТИНЫ — resolvedToFileId.
      // ============================================
      //
      // ПРОБЛЕМА (v15.0.6):
      //   `isExternal` вычислялся из `imp.toFileId` (AST), а
      //   `resolvedToFileId` — из `resolveToFileId` (который для
      //   алиасов `@/components/ui` возвращал `external:@/components`).
      //   В результате в full.json получалось:
      //     toFileId = "external:@/components"
      //     isExternal = false
      //   Это внутреннее противоречие. При decode бит 4
      //   (isExternal) в compact.gr.i.ty не выставлялся, и
      //   decode восстанавливал `unresolved:@/components/ui`,
      //   а не `external:@/components`. Round-trip ломался.
      //
      // РЕШЕНИЕ (v15.0.7):
      //   1. Сначала вычисляем `resolvedToFileId` — уважая непустые
      //      значения из AST (`external:*`, `unresolved:*`), иначе
      //      резолвим сами.
      //   2. `isExternal`/`isUnresolved` — ПРОИЗВОДНЫЕ от
      //      `resolvedToFileId`. Это гарантирует согласованность:
      //        resolvedToFileId.startsWith('external:')   → isExternal = true
      //        resolvedToFileId.startsWith('unresolved:') → isUnresolved = true
      //        /^f\d+$/.test(resolvedToFileId)            → локальный
      //   3. В `resolveToFileId` алиасы `@/`, `~/`, `#/` больше
      //      НЕ превращаются в `external:*` (см. правку в функции).
      // ============================================
      const toFileIdFromAst = (imp as any).toFileId as string | undefined;

      // Шаг 1: вычисляем resolvedToFileId
      let resolvedToFileId: string | null = null;

      if (
        toFileIdFromAst?.startsWith('external:') ||
        toFileIdFromAst?.startsWith('unresolved:')
      ) {
        // AST уже дал финальный маркер — уважаем его
        resolvedToFileId = toFileIdFromAst;
      } else {
        // AST вернул f*, null или undefined — резолвим сами
        resolvedToFileId = resolveToFileId(imp.source, filePath, sourceToFileIdMap, fileMap);
        if (!resolvedToFileId) {
          resolvedToFileId = toFileIdFromAst || `unresolved:${imp.source}`;
        }
      }

      // Шаг 2: isExternal/isUnresolved — ПРОИЗВОДНЫЕ от resolvedToFileId
      const isExternal = resolvedToFileId?.startsWith('external:') === true;
      const isUnresolved = resolvedToFileId?.startsWith('unresolved:') === true;

      // Шаг 3: packageName для external
      let packageName: string | undefined;
      if (isExternal && resolvedToFileId) {
        const pkgPart = resolvedToFileId.slice('external:'.length);
        packageName = pkgPart || undefined;
      } else if (isExternal) {
        // fallback: если resolvedToFileId почему-то пуст
        packageName = (imp as any).packageName;
      }

      // Шаг 4: финальная гарантия формата toFileId
      if (
        resolvedToFileId &&
        !/^f\d+$/.test(resolvedToFileId) &&
        !resolvedToFileId.startsWith('external:') &&
        !resolvedToFileId.startsWith('unresolved:')
      ) {
        resolvedToFileId = `unresolved:${imp.source}`;
      }

      // Шаг 5: на случай, если resolvedToFileId остался null
      // (пустой source, что маловероятно, но защищаемся)
      if (resolvedToFileId === null && !isExternal && !isUnresolved) {
        resolvedToFileId = `unresolved:${imp.source}`;
      }

      // ✅ v15.0.7-fix: isUnresolved используется в диагностике ниже.
      //   Гарантируем, что переменная не «висит» без использования.
      if (verbose && isUnresolved) {
        // счётчик неразрешённых импортов собирается отдельно ниже
      }

      const impLine = imp.loc?.start?.line ?? (imp as any).line ?? 0;

      // ✅ v15.0.4: Приоритет specifiersStructured > specifiers > isReExport
      if (specifiersStructured.length > 0) {
        for (const spec of specifiersStructured) {
          // ✅ v15.0.4: fallback-имена
          let importedName = spec.imported || '';
          let localName = spec.local || '';

          if (!importedName && !localName) {
            // Определяем fallback по типу specifier
            if (spec.type === 'ExportAllSpecifier' || spec.type === 'ImportNamespaceSpecifier') {
              importedName = '*';
              localName = '*';
            } else if (spec.type === 'ImportDefaultSpecifier') {
              importedName = 'default';
              localName = path.basename(imp.source).replace(/\.[^.]+$/, '');
            } else {
              // Используем имя файла без расширения
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

          // ✅ v15.0.4: проброс флагов реэкспорта
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

          // ✅ v15.0.4: fallback-имена
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

          // ✅ v15.0.4: проброс флагов реэкспорта
          if (isReExport) {
            importData.isReExport = true;
            if (isStarReExport) importData.isStarReExport = true;
          }

          imports.push(importData);
        }
      } else {
        // ✅ v15.0.4: даже если specifiers пуст — но isReExport === true
        //    (export * from './foo' без явных specifiers) — создаём запись
        if (isReExport) {
          // ✅ v15.0.6: не дублировать — extract-entities-from-ast уже
          //   создаёт запись в imports[] для `export * from './foo'`
          //   (см. handleExportAllAsImport в extract-entities-from-ast.ts).
          //
          //   Здесь мы попадаем в эту ветку только если specifiers пуст,
          //   но isReExport === true. Проверяем: если запись для этого же
          //   (fromFileId, source) уже есть в imports[] — пропускаем.
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
    if (emptyNameFixCount > 0) {
      console.log(`   🔧 Исправлено пустых имён импортов: ${emptyNameFixCount}`);
    }
  }

  // ============================================
  // ✅ v9.0.0: СБОР НОВЫХ СЕКЦИЙ
  // ============================================
  for (const [filePath, entities] of Object.entries(workingEntitiesMap)) {
    if (!entities) continue;

    // ✅ v15.0.3: нормализация пути
    const absolutePath = path.resolve(filePath);
    const relativePath = path
      .relative(projectRoot, absolutePath)
      .replace(/\\/g, '/');

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
  // Статистика
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
  };

  if ('totalConditionals' in statistics || true) {
    (statistics as any).totalConditionals = totalConditionals;
  }

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
  };

  // ============================================
  // ✅ v14.0.0: КАНОНИЗАЦИЯ
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

/**
 * ✅ v9.0.7: аварийная функция — добавляет числовой суффикс,
 * пока результат не станет уникальным относительно исходного пути.
 */
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

/**
 * ✅ v8.5.0: resolveToFileId с полной интеграцией tsconfig.
 *
 * ✅ v15.0.7-fix: алиасы `@/`, `~/`, `#/` больше НЕ классифицируются
 *   как external. Раньше `@/components/ui` превращался в
 *   `external:@/components`, что давало рассинхрон с `isExternal`
 *   (для `@/` он равен `false`, т.к. это алиас проекта).
 *
 *   Теперь алиасы проекта возвращают `null`, и выше по коду они
 *   превращаются в `unresolved:@/components/ui` — согласованно
 *   с `isExternal = false`.
 *
 * ✅ v15.0.3: sourceToFileIdMap теперь содержит И относительные,
 *   И абсолютные варианты пути.
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

  // ============================================
  // 5. Внешний пакет (но НЕ алиас проекта)
  // ============================================
  // ✅ v15.0.7-fix: алиасы `@/`, `~/`, `#/` — это НЕ внешние
  //   пакеты, а алиасы проекта. Раньше они ошибочно превращались
  //   в `external:@/components`, что давало рассинхрон с
  //   `isExternal` (который для них равен `false`).
  //
  //   Теперь для алиасов возвращаем `null` — выше по коду это
  //   превратится в `unresolved:${source}`.
  if (!source.startsWith('.')) {
    // Алиасы проекта — не external
    const isProjectAlias =
      source.startsWith('@/') ||
      source.startsWith('~/') ||
      source.startsWith('#/') ||
      source === '@' ||
      source === '~' ||
      source === '#';

    if (isProjectAlias) {
      return null; // → станет unresolved:@/components/ui
    }

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

/**
 * Определяет тип вызова по контексту.
 *
 * ✅ v14.0.0: добавлена явная проверка `_callback` в имени.
 */
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
