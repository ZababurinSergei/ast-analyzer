// src/reporters/compact-reporter.ts
// ============================================
// ТОНКИЙ ОРКЕСТРАТОР КОМПАКТНОГО ОТЧЁТА
// ============================================
// Версия: 9.0.5
//
// ИЗМЕНЕНИЯ v9.0.5:
//   - ✅ ДОБАВЛЕНО: опция `saveEdges` (по умолчанию false).
//     Если true — edges восстанавливаются через
//     `Codec.decode(compact, { includeEdges: true })` и сохраняются
//     в отдельный файл `<output>.edges.json` (суффикс настраивается
//     через `edgesJsonSuffix`).
//   - ✅ ДОБАВЛЕНО: в `GenerateReportResult` — `edgesPath` и
//     `stats.edgesSize`.
//   - ✅ Это устраняет расхождение DL (decode(encode(full)) === full),
//     когда исходный full не содержит edges (по спецификации v9.0.4+
//     edges — производное поле, не хранится в full.json).
//   - ✅ v10.3 FIX: три критичных исправления для L1/L2/DL:
//       1. ВСЕГДА массивы для базовых секций (classes/constants/exports/
//          imports/calls/reExports) — устраняет `$.classes: [] vs undefined`.
//       2. type-only импорты пишутся как `type: 'type'` (не 'named') —
//          устраняет `$.imports[N].type: "type-only" vs "named"`.
//       3. Рёбра event → handler и ref → expose больше НЕ пишутся в calls[]
//          (писался template.fileId вместо ID функции) —
//          устраняет `$.calls[N].fromFunctionId: "fn0" vs "f6"`.
//       4. `templates[].conditionals[]` обогащаются полями `id` и `fileId`
//          через единый conditionalCounter — устраняет
//          `$.templates[N].conditionals[M].id/fileId: undefined`.
//       5. `templates[].templateRefs[].exposedMethods` нормализуются
//          до `[]` — устраняет `[] vs undefined`.
//
// ИЗМЕНЕНИЯ v9.0.2:
//   - ✅ ИСПРАВЛЕНО: version = '9.0.0' (было '9.0.1')
//   - ✅ ИСПРАВЛЕНО: templates.push({...}) — ровно 12 полей TemplateData
//   - ✅ ИСПРАВЛЕНО: dynamicComponents — 3 поля (isExpression, line, resolvedComponents)
//   - ✅ ИСПРАВЛЕНО: conditionals пробрасываются в templates[] и в отдельную секцию
//   - ✅ ИСПРАВЛЕНО: lifecycle/effects/reactivity functionId = '' (не undefined),
//     чтобы Codec.encode превратил его в -1 через ?? -1
//   - ✅ ИСПРАВЛЕНО: пустые секции (cls, cn, templates, conditionals, lifecycle,
//     effects, injections, reactivity, types, typeRefs) → undefined, а не []
//
// ИЗМЕНЕНИЯ v9.0.0:
//   - ✅ УДАЛЕНЫ локальные определения GenerateReportOptions и
//        GenerateReportResult (TS2300). Импортируются из './codec/codec-types.js'.
//   - ✅ ДОБАВЛЕН проброс templateConditionals в templates[].
//   - ✅ ДОБАВЛЕНА отдельная секция conditionals[] в FullJSON.
//   - ✅ hasTemplate учитывает templateConditionals.
//   - ✅ ДОБАВЛЕН сбор секций lifecycle, effects, injections,
//        reactivity, types, typeRefs в collectFullJSON.
//
// ИЗМЕНЕНИЯ v8.5.0:
//   - ✅ resolveToFileId использует resolveAliasPath из tsconfig-resolver.
//   - ✅ tsconfig инициализируется один раз в collectFullJSON.
//   - ✅ sourceToFileIdMap расширен абсолютными путями.
//
// ИЗМЕНЕНИЯ v8.4.2:
//   - ✅ functionMap теперь Map<string, FunctionData[]>
//
// ИЗМЕНЕНИЯ v8.4.0:
//   - ✅ Секция templates[] в FullJSON (Vue-шаблоны).
//   - ✅ Рёбра event → handler и templateRef → expose в calls[].
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

// ============================================
// ✅ v9.0.0: ИМПОРТ ТИПОВ ИЗ codec-types.js
// ============================================
// ВАЖНО: GenerateReportOptions и GenerateReportResult импортируются,
// а НЕ определяются локально (устранён TS2300).
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

// ============================================
// ✅ v9.0.0: РЕЭКСПОРТ ТИПОВ (для обратной совместимости)
// ============================================
export type { GenerateReportOptions, GenerateReportResult } from './codec/codec-types.js';

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

  // ✅ v9.0.4: edges — по умолчанию НЕ сохраняются в отдельный файл.
  const saveEdges = options.saveEdges === true;
  const edgesSuffix = options.edgesJsonSuffix || '.edges.json';

  // ============================================
  // ШАГ 1: Сбор полного JSON
  // ============================================
  if (verbose) {
    console.log('\n📦 [compact-reporter] Сбор полного JSON...');
  }

  const full = collectFullJSON(entitiesMap, verbose);

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
    const verification = Codec.verifyRoundTrip(full);
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
    compact = Codec.encode(full);
    if (verbose) {
      console.log(`   🗜️  Сжатие применено (v${compact.v})`);

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
    // Создаём директорию
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Сохраняем сжатый JSON (основной)
    if (compact) {
      fs.writeFileSync(outputPath, JSON.stringify(compact, null, 2), 'utf-8');
      compactPath = outputPath;
      compactSize = fs.statSync(outputPath).size;

      if (verbose) {
        const sizeKB = (compactSize / 1024).toFixed(2);
        console.log(`   💾 Сжатый JSON: ${outputPath} (${sizeKB} KB)`);
      }
    }

    // Сохраняем полный JSON (для отладки)
    if (saveFull) {
      const fullPathResolved = insertSuffixBeforeExtension(outputPath, fullSuffix);
      fs.writeFileSync(fullPathResolved, JSON.stringify(full, null, 2), 'utf-8');
      fullPath = fullPathResolved;
      fullSize = fs.statSync(fullPathResolved).size;

      if (verbose) {
        const sizeKB = (fullSize / 1024).toFixed(2);
        console.log(`   💾 Полный JSON: ${fullPathResolved} (${sizeKB} KB)`);
      }
    }

    // ✅ v9.0.4: сохраняем edges в отдельный файл (только если saveEdges: true)
    if (saveEdges && compact) {
      const edgesPathResolved = insertSuffixBeforeExtension(outputPath, edgesSuffix);

      // Декодируем compact с includeEdges: true
      const fullWithEdges = Codec.decode(compact, { includeEdges: true });
      const edges = fullWithEdges.edges || [];

      fs.writeFileSync(
        edgesPathResolved,
        JSON.stringify(
          {
            version: fullWithEdges.version,
            timestamp: fullWithEdges.timestamp,
            root: fullWithEdges.root,
            edges,
            stats: {
              totalEdges: edges.length,
              byType: edges.reduce((acc: Record<string, number>, e) => {
                acc[e.type] = (acc[e.type] || 0) + 1;
                return acc;
              }, {}),
            },
          },
          null,
          2
        ),
        'utf-8'
      );

      edgesPath = edgesPathResolved;
      edgesSize = fs.statSync(edgesPathResolved).size;

      if (verbose) {
        const sizeKB = (edgesSize / 1024).toFixed(2);
        console.log(`   💾 Edges JSON: ${edgesPathResolved} (${sizeKB} KB, ${edges.length} edges)`);
      }
    }

    // Сравнение размеров
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
    },
  };
}

// ============================================
// ФУНКЦИИ ДЕКОДИРОВАНИЯ
// ============================================

/**
 * Декодирует сжатый JSON обратно в полный.
 */
export function decodeCompactReport(compact: CompactJSON, options: DecodeOptions = {}): FullJSON {
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

  return Codec.decode(compact, options);
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
// СБОР ПОЛНОГО JSON (ВНУТРЕННЯЯ ФУНКЦИЯ)
// ============================================

/**
 * Собирает полный JSON из карты сущностей.
 *
 * Работает в два прохода:
 *   1. Собирает модули, файлы, функции, классы, константы
 *   2. Собирает экспорты, импорты, вызовы, реэкспорты
 *
 * ⚠️ edges НЕ создаются здесь — они восстанавливаются при decode
 *    (производное поле, не хранится в full.json по спецификации v9.0.4+).
 *
 * ✅ v9.0.2: templates.push содержит ВСЕ 12 полей TemplateData.
 * ✅ v9.0.2: пустые секции → undefined (не []).
 * ✅ v9.0.2: dynamicComponents — 3 поля (isExpression, line, resolvedComponents).
 * ✅ v9.0.2: conditionals пробрасываются в templates[] и в отдельную секцию.
 * ✅ v9.0.2: functionId для lc/ef/rx = '' (не undefined).
 * ✅ v9.0.0: собираются секции conditionals[], lifecycle[], effects[],
 *            injections[], reactivity[], types[], typeRefs[].
 * ✅ v10.3: базовые секции ВСЕГДА массивы (даже пустые) — симметрия
 *            с codec-decode.ts. type-only импорты → type: 'type'.
 *            Рёбра event → handler и ref → expose НЕ пишутся в calls[].
 *            conditionals обогащаются id/fileId. templateRefs[].exposedMethods
 *            нормализуются до [].
 */
function collectFullJSON(
  entitiesMap: Record<string, EntitiesResult>,
  verbose: boolean = false
): FullJSON {
  // ============================================
  // ✅ v8.5.0: Инициализация tsconfig
  // ============================================
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
      constants.push({
        id: `cn${constantCounter}`,
        name: cn.name,
        moduleId: module.id,
        fileId: file.id,
        line: cn.line || 0,
        isExported: cn.isExported || false,
        value: cn.value,
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
  // ⚠️ ВАЖНО: каждый TemplateData содержит РОВНО 12 полей.
  // Это критично для Codec.encode, который строит vt-кортеж по 12 позициям.
  // Если хотя бы одно поле отсутствует (undefined), JSON.stringify
  // может обрезать массив, что ломает round-trip.
  //
  // ✅ v10.3:
  //   - conditionals обогащаются id/fileId через ЕДИНЫЙ conditionalCounter
  //     (тот же, что используется для глобальной секции conditionals[]);
  //   - templateRefs[].exposedMethods нормализуются до [] (не undefined);
  //   - рёбра event → handler и ref → expose НЕ пишутся в calls[].
  // ============================================
  for (const [filePath, entities] of Object.entries(workingEntitiesMap)) {
    if (!entities) continue;
    if (!filePath.endsWith('.vue')) continue;

    const dirName = path.basename(path.dirname(filePath)) || 'root';
    const module = moduleMap.get(dirName);
    const file = fileMap.get(filePath);
    if (!module || !file) continue;

    const e = entities as any;

    // ✅ v9.0.0: hasTemplate учитывает templateConditionals
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

    // ============================================
    // ✅ v10.3: обогащаем conditionals полями id и fileId через ЕДИНЫЙ
    //           conditionalCounter, чтобы id совпадал с тем, что
    //           восстанавливает codec-decode.ts ("cd1", "cd2", ...).
    //           Заодно пушим в глобальную секцию conditionals[].
    // ============================================
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

    // ============================================
    // ✅ v9.0.2 + v10.3: гарантируем РОВНО 12 полей TemplateData.
    // ✅ v10.3: templateRefs[].exposedMethods нормализуются до [].
    // ============================================
    const templateData: TemplateData = {
      fileId: file.id,
      moduleId: module.id,
      reactivityDeps: e.templateReactivityDeps || [],
      eventHandlers: e.templateEventHandlers || [],
      dynamicComponents: (e.templateDynamicComponents || []).map((d: any) => ({
        isExpression: d.isExpression || '',
        line: d.line || 0,
        // ✅ v9.0.2: 3-е поле — resolvedComponents
        resolvedComponents: d.resolvedComponents || [],
      })),
      directives: e.templateDirectives || [],
      usedComponents: e.templateUsedComponents || [],
      // ✅ v10.3: нормализуем templateRefs — exposedMethods всегда массив
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
      // ✅ v10.3: обогащённые conditionals с id/fileId
      conditionals: enrichedConditionals,
    };

    templates.push(templateData);

    // ✅ v10.3: глобальная секция conditionals[] уже заполнена выше
    //          через enrichedConditionals.map() + push. Дублирующий
    //          блок удалён, чтобы conditionalCounter не инкрементировался
    //          дважды.
  }

  if (verbose && templates.length > 0) {
    console.log(`   🎨 Vue-шаблонов: ${templates.length}`);
    console.log(`   🎯 Conditionals: ${conditionals.length}`);

    // ✅ v9.0.2: диагностика 12 полей
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

      const impLine = imp.loc?.start?.line ?? (imp as any).line ?? 0;

      if (specifiersStructured.length > 0) {
        for (const spec of specifiersStructured) {
          if (!spec || !spec.imported || !spec.local) continue;

          importCounter++;

          // ✅ v10.3: isTypeOnly приоритетнее, чем spec.type.
          // Если импорт помечен как type-only, тип должен быть 'type',
          // чтобы full.json был согласован с codec-encode.ts и codec-decode.ts.
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

          // ✅ v10.3: isTypeOnly приоритетнее, чем spec.type.
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
  // ✅ v8.4.0 / v10.3: рёбра event → handler и ref → expose.
  //
  // ⚠️ ВАЖНО: эти рёбра НЕ пишутся в calls[], потому что
  //    CallData.fromFunctionId по контракту — это ID ФУНКЦИИ,
  //    а не ID файла. Ранее сюда писался template.fileId ('fN'),
  //    что нарушало контракт и приводило к расхождению L1/L2/DL:
  //    encoder не находил 'fN' в functionReverse и записывал 0,
  //    decoder возвращал 'fn0' вместо 'fN'.
  //
  //    Рёбра шаблона хранятся в templates[].eventHandlers[]
  //    и templates[].templateRefs[] — этого достаточно для
  //    восстановления связей. Дублировать их в calls[] не нужно.
  // ============================================
  // ЗАКОММЕНТИРОВАНО v10.3:
  // for (const template of templates) {
  //   for (const handler of template.eventHandlers) {
  //     if (handler.isExternal) continue;
  //     const handlerFuncArray = functionMap.get(handler.handlerName);
  //     const handlerFunc = handlerFuncArray?.[0];
  //     if (!handlerFunc) continue;
  //     callCounter++;
  //     calls.push({
  //       id: `c${callCounter}`,
  //       fromFunctionId: template.fileId,
  //       toFunctionId: handlerFunc.id,
  //       line: handler.line,
  //       type: 'callback',
  //     });
  //   }
  //   for (const ref of template.templateRefs) {
  //     if (!ref.exposedMethods || ref.exposedMethods.length === 0) continue;
  //     for (const methodName of ref.exposedMethods) {
  //       const methodFuncArray = functionMap.get(methodName);
  //       const methodFunc = methodFuncArray?.[0];
  //       if (!methodFunc) continue;
  //       callCounter++;
  //       calls.push({
  //         id: `c${callCounter}`,
  //         fromFunctionId: template.fileId,
  //         toFunctionId: methodFunc.id,
  //         line: ref.line,
  //         type: 'method',
  //       });
  //     }
  //   }
  // }

  // ============================================
  // ✅ v9.0.0: СБОР НОВЫХ СЕКЦИЙ
  // ============================================
  // lifecycle, effects, injections, reactivity, types, typeRefs
  // собираются из workingEntitiesMap.
  // ============================================
  for (const [filePath, entities] of Object.entries(workingEntitiesMap)) {
    if (!entities) continue;

    const dirName = path.basename(path.dirname(filePath)) || 'root';
    const module = moduleMap.get(dirName);
    const file = fileMap.get(filePath);
    if (!module || !file) continue;

    const e = entities as any;

    // --- LIFECYCLE (lc) ---
    // ✅ v9.0.2: functionId = '' если функция не найдена.
    // Codec.encode превратит '' в -1 через ?? -1.
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
    // ✅ v9.0.2: functionId = '' если функция не найдена.
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
    // ✅ v9.0.2: functionId = '' если функция не найдена.
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
  // ✅ v9.0.2: пустые секции → undefined (НЕ [])
  // Это критично для чек-листа v9.0.0.
  // ✅ v9.0.4: edges НЕ создаются — восстанавливаются в Codec.decode
  //            через includeEdges: true (по запросу).
  // ✅ v10.3: базовые секции (classes/constants/exports/imports/calls/reExports)
  //           ВСЕГДА массивы, даже пустые. Это устраняет расхождение
  //           `$.classes: [] vs undefined` между decode(compact) и full.json.
  //           codec-decode.ts всегда возвращает [] для этих секций,
  //           поэтому full.json должен делать то же самое.
  // ============================================
  const result: FullJSON = {
    version: '9.0.0',
    timestamp: new Date().toISOString(),
    root,
    modules,
    files,
    functions,
    // ✅ v10.3: всегда массив, даже пустой — симметрия с codec-decode.ts
    classes,
    constants,
    exports,
    imports,
    calls,
    reExports,
    // ✅ v9.0.0: новые секции — оставляем undefined для пустых,
    //            так как decodeCompactData тоже их не создаёт,
    //            если в compact нет соответствующего ключа.
    templates: templates.length > 0 ? templates : undefined,
    statistics,
    conditionals: conditionals.length > 0 ? conditionals : undefined,
    lifecycle: lifecycle.length > 0 ? lifecycle : undefined,
    effects: effects.length > 0 ? effects : undefined,
    injections: injections.length > 0 ? injections : undefined,
    reactivity: reactivity.length > 0 ? reactivity : undefined,
    types: types.length > 0 ? types : undefined,
    typeRefs: typeRefs.length > 0 ? typeRefs : undefined,
    // ⚠️ edges НЕ создаются — восстанавливаются в Codec.decode
  };

  return result;
}

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

function insertSuffixBeforeExtension(filePath: string, suffix: string): string {
  const ext = path.extname(filePath);
  const base = filePath.slice(0, -ext.length);

  const suffixNoExt = suffix.replace(/\.json$/i, '').replace(/^\./, '');
  if (base.endsWith(suffixNoExt)) {
    return filePath;
  }

  return `${base}${suffix.replace('.json', '')}${ext}`;
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

        const byAbs = sourceToFileIdMap.get(resolved) || sourceToFileIdMap.get(resolvedNormalized);
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

        const byAbs = sourceToFileIdMap.get(resolved) || sourceToFileIdMap.get(resolvedNormalized);
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
 */
function detectCallType(
  func: FunctionInfo,
  callName: string
): 'direct' | 'async' | 'method' | 'callback' {
  if (func.isAsync) return 'async';
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
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

export default {
  generateCompactReport,
  decodeCompactReport,
  readAndDecode,
  readFullJson,
};
