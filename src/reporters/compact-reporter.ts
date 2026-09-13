// src/reporters/compact-reporter.ts
// ============================================
// ТОНКИЙ ОРКЕСТРАТОР КОМПАКТНОГО ОТЧЁТА
// ============================================
// Версия: 8.1.0 (Стратегия B — строгий round-trip + DecodeOptions)
//
// ИЗМЕНЕНИЯ v8.1.0:
//   - readAndDecode(path, options?: DecodeOptions) — прокидывает опции в Codec.decode
//   - decodeCompactReport(compact, options?: DecodeOptions) — прокидывает опции
//   - Поддержка includeEdges / includeEmptyArrays / includeStatistics
//
// ИЗМЕНЕНИЯ v8.0.0:
//   - collectFullJSON: modules[].fileIds заполняются
//   - collectFullJSON: files[].moduleId заполняется
//   - collectFullJSON: functions[].params, returnType прокидываются
//   - collectFullJSON: classes[].methods прокидываются
//   - collectFullJSON: constants[].value прокидывается
//   - collectFullJSON: imports line берётся из loc.start.line
//   - collectFullJSON: imports isExternal через isExternalModule
//   - collectFullJSON: exports line, localName, isTypeOnly
//   - collectFullJSON: reExports отдельно от exports
//   - collectFullJSON: reExports type: 'named'|'default'|'all'
//   - collectFullJSON: calls external → 'external:name'
//   - collectFullJSON: НЕ создаёт edges (восстанавливается в decode)
//   - resolveToFileId: обработка external, unresolved, alias
//   - detectCallType: различает direct/async/method/callback
// ============================================

import fs from 'fs';
import path from 'path';
import type { EntitiesResult, FunctionInfo } from '../types.js';
import { Codec } from './codec/codec.js';
import { isExternalModule, resolveFilePath } from '../core/ast-parser.js';
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
  DecodeOptions,
} from './codec/codec-types.js';

// ============================================
// ТИПЫ ОПЦИЙ И РЕЗУЛЬТАТА
// ============================================

export interface GenerateReportOptions {
  /** Путь к выходному файлу (сжатый JSON) */
  outputPath?: string;
  /** Использовать сжатие (по умолчанию: true) */
  compress?: boolean;
  /** Сохранять полный JSON для отладки (по умолчанию: true) */
  saveFullJson?: boolean;
  /** Дополнительный суффикс для полного JSON (по умолчанию: '.full.json') */
  fullJsonSuffix?: string;
  /** Подробный вывод (по умолчанию: false) */
  verbose?: boolean;
}

export interface GenerateReportResult {
  /** Полный (читаемый) JSON */
  full: FullJSON;
  /** Сжатый JSON (если compress: true) */
  compact?: CompactJSON;
  /** Путь к сохранённому сжатому файлу */
  compactPath?: string;
  /** Путь к сохранённому полному файлу */
  fullPath?: string;
  /** Статистика генерации */
  stats: {
    /** Длительность в миллисекундах */
    duration: number;
    /** Размер сжатого файла в байтах */
    compactSize?: number;
    /** Размер полного файла в байтах */
    fullSize?: number;
    /** Коэффициент сжатия (%) */
    compressionRatio?: number;
  };
}

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
  const saveFull = options.saveFullJson !== false;
  const fullSuffix = options.fullJsonSuffix || '.full.json';

  // ============================================
  // ШАГ 1: Сбор полного JSON
  // ============================================

  if (verbose) {
    console.log('\\n📦 [compact-reporter] Сбор полного JSON...');
  }

  const full = collectFullJSON(entitiesMap, verbose);

  if (verbose) {
    console.log(`   📊 Модулей: ${full.modules.length}`);
    console.log(`   📄 Файлов: ${full.files.length}`);
    console.log(`   ƒ  Функций: ${full.functions.length}`);
    console.log(`   📦 Классов: ${full.classes.length}`);
    console.log(`   📌 Констант: ${full.constants.length}`);
    console.log(`   📤 Экспортов: ${full.exports.length}`);
    console.log(`   📥 Импортов: ${full.imports.length}`);
    console.log(`   📞 Вызовов: ${full.calls.length}`);
    console.log(`   🔄 Реэкспортов: ${full.reExports.length}`);
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
    }
  }

  // ============================================
  // ШАГ 4: Сохранение файлов
  // ============================================

  let compactPath: string | undefined;
  let fullPath: string | undefined;
  let compactSize: number | undefined;
  let fullSize: number | undefined;
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
    console.log('✅ [compact-reporter] Готово\\n');
  }

  return {
    full,
    compact,
    compactPath,
    fullPath,
    stats: {
      duration,
      compactSize,
      fullSize,
      compressionRatio,
    },
  };
}

// ============================================
// ФУНКЦИИ ДЕКОДИРОВАНИЯ
// ============================================

/**
 * Декодирует сжатый JSON обратно в полный.
 *
 * @param compact — сжатый JSON
 * @param options — опции декодирования (includeEdges, includeEmptyArrays, includeStatistics)
 * @returns Полный JSON
 */
export function decodeCompactReport(
  compact: CompactJSON,
  options: DecodeOptions = {}
): FullJSON {
  return Codec.decode(compact, options);
}

/**
 * Читает сжатый JSON из файла и декодирует его.
 *
 * @param compactPath — путь к сжатому JSON
 * @param options — опции декодирования (includeEdges, includeEmptyArrays, includeStatistics)
 * @returns Полный JSON
 */
export function readAndDecode(
  compactPath: string,
  options: DecodeOptions = {}
): FullJSON {
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
 *
 * @param fullPath — путь к полному JSON
 * @returns Полный JSON
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
 * ⚠️ edges НЕ создаются здесь — они восстанавливаются при decode.
 *
 * @param entitiesMap — карта «путь файла → сущности»
 * @param verbose — подробный вывод
 * @returns Полный JSON
 */
function collectFullJSON(
  entitiesMap: Record<string, EntitiesResult>,
  verbose: boolean = false
): FullJSON {
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

  // ============================================
  // Карты для дедупликации
  // ============================================

  const moduleMap = new Map<string, ModuleData>();
  const fileMap = new Map<string, FileData>();
  const functionMap = new Map<string, FunctionData>();

  // Карта «source → fileId» для быстрого разрешения импортов
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

  // ============================================
  // ПЕРВЫЙ ПРОХОД: модули, файлы, функции, классы, константы
  // ============================================

  for (const [filePath, entities] of Object.entries(entitiesMap)) {
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

    // ✅ Заполняем карту source → fileId
    const normalizedPath = filePath.replace(/\\\\/g, '/');
    sourceToFileIdMap.set(normalizedPath, file.id);
    sourceToFileIdMap.set(filePath, file.id);
    sourceToFileIdMap.set(path.basename(filePath), file.id);
    sourceToFileIdMap.set(path.basename(filePath).replace(/\\.[^.]+$/, ''), file.id);

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
        // ✅ Прокидываем params и returnType
        params: func.params || [],
        returnType: func.returnType,
      };

      functions.push(funcData);
      functionMap.set(func.name, funcData);
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
        // ✅ Прокидываем methods
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
        // ✅ Прокидываем value
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
  // ВТОРОЙ ПРОХОД: экспорты, импорты, вызовы, реэкспорты
  // ============================================

  for (const [filePath, entities] of Object.entries(entitiesMap)) {
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

      // Ищем функцию в глобальной карте
      const funcData = functionMap.get(exp.name);

      // ✅ Реальная строка из loc, fallback на exp.line
      const expLine = exp.loc?.start?.line ?? exp.line ?? 0;

      // ✅ Локальное имя
      const localName = exp.localName ?? exp.name;

      // ✅ isTypeOnly
      const isTypeOnly = exp.isTypeOnly ?? false;

      // ✅ Флаги реэкспорта
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

        // ⚠️ Не создаём запись в exports — реэкспорты только здесь
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

      // ✅ isExternal через ast-parser (уже исправлен)
      const isExternal = (imp as any).isExternal ?? isExternalModule(imp.source);

      const packageName = isExternal
        ? (imp as any).packageName ||
        (imp.source.startsWith('@')
          ? imp.source.split('/').slice(0, 2).join('/')
          : imp.source.split('/')[0])
        : undefined;

      // ✅ Разрешаем toFileId
      let resolvedToFileId: string | null = null;

      if (isExternal) {
        resolvedToFileId = `external:${packageName || imp.source}`;
      } else {
        resolvedToFileId = resolveToFileId(imp.source, filePath, sourceToFileIdMap, fileMap);
        if (!resolvedToFileId) {
          resolvedToFileId = (imp as any).toFileId || `unresolved:${imp.source}`;
        }
      }

      // ✅ Реальная строка импорта
      const impLine = imp.loc?.start?.line ?? (imp as any).line ?? 0;

      if (specifiersStructured.length > 0) {
        // Используем структурированные specifiers
        for (const spec of specifiersStructured) {
          if (!spec || !spec.imported || !spec.local) continue;

          importCounter++;

          const importType = getImportTypeFromSpecifierType(spec.type);

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
        // Fallback: парсим строковые specifiers
        for (const spec of specifiers as unknown[]) {
          let importedName = '';
          let localName = '';
          let importType: 'named' | 'default' | 'namespace' | 'type' = 'named';
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
            }
          }

          if (!importedName || !localName) continue;

          importCounter++;

          imports.push({
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

      const fromFunc = functionMap.get(func.name);
      if (!fromFunc) continue;

      const callsList = func.calls || [];

      for (const callName of callsList) {
        if (!callName) continue;

        const toFunc = functionMap.get(callName);

        // ✅ Определяем тип вызова
        const callType = detectCallType(func, callName);

        if (!toFunc) {
          // ✅ Внешний вызов — кодируем как 'external:name'
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

        // Пропускаем самовызовы
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
  };

  // ============================================
  // Определение корневого модуля
  // ============================================

  let root = 'm0';

  // Ищем index.ts в корне src
  for (const file of files) {
    if (file.path.endsWith('src/index.ts') || file.path.endsWith('src\\\\index.ts')) {
      const module = modules.find(m => m.id === file.moduleId);
      if (module) {
        root = module.id;
        break;
      }
    }
  }

  // Fallback: первый модуль
  if (root === 'm0' && modules.length > 0) {
    const firstModule = modules[0];
    if (firstModule) {
      root = firstModule.id;
    }
  }

  // ============================================
  // Финальный объект
  // ============================================

  return {
    version: '8.0.0',
    timestamp: new Date().toISOString(),
    root,
    modules,
    files,
    functions,
    classes,
    constants,
    exports,
    imports,
    calls,
    reExports,
    statistics,
    // ⚠️ edges НЕ создаются — восстанавливаются в Codec.decode
  };
}

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

/**
 * Вставляет суффикс перед расширением файла.
 *
 * Пример:
 *   insertSuffixBeforeExtension('report.json', '.full')
 *   → 'report.full.json'
 *
 * @param filePath — исходный путь
 * @param suffix — суффикс (с точкой)
 * @returns Путь с суффиксом
 */
function insertSuffixBeforeExtension(filePath: string, suffix: string): string {
  const ext = path.extname(filePath);
  const base = filePath.slice(0, filePath.length - ext.length);
  return `${base}${suffix}${ext}`;
}

/**
 * Разрешает source импорта в fileId проекта.
 *
 * Стратегии:
 *   1. Алиасы проекта (@/, #/, ~/) — поиск по basename
 *   2. Относительные пути (./, ../) — через resolveFilePath
 *   3. Прямой поиск в sourceToFileIdMap
 *   4. Поиск по basename
 *   5. Внешние пакеты → external:name
 *
 * @param source — исходный путь импорта
 * @param fromFilePath — путь к файлу-импортёру
 * @param sourceToFileIdMap — карта source → fileId
 * @param fileMap — карта filePath → FileData
 * @returns ID файла, external:name или null
 */
function resolveToFileId(
  source: string,
  fromFilePath: string,
  sourceToFileIdMap: Map<string, string>,
  fileMap: Map<string, FileData>
): string | null {
  // ============================================
  // 1. Алиасы проекта (@/, #/, ~/)
  // ============================================
  if (source.startsWith('@/') || source.startsWith('#/') || source.startsWith('~/')) {
    const rest = source.replace(/^(@|#|~)\//, ''); // ← один обратный слэш
    const sourceBasename = path.basename(rest);
    const sourceNoExt = sourceBasename.replace(/\.[^.]+$/, '');

    for (const [filePath, fileData] of fileMap) {
      const fileBasename = path.basename(filePath);
      const fileNoExt = fileBasename.replace(/\.[^.]+$/, '');
      if (fileBasename === sourceBasename || fileNoExt === sourceNoExt) {
        return fileData.id;
      }
    }
  }

  // ============================================
  // 2. Относительные пути (./, ../)
  // ============================================
  if (source.startsWith('.')) {
    try {
      const fromDir = path.dirname(fromFilePath);
      const resolved = resolveFilePath(fromDir, source);
      if (resolved) {
        const resolvedFile = fileMap.get(resolved);
        if (resolvedFile) return resolvedFile.id;

        // Нормализуем путь для поиска
        const normalizedResolved = resolved.replace(/\\\\/g, '/');
        for (const [filePath, fileData] of fileMap) {
          if (filePath.replace(/\\\\/g, '/') === normalizedResolved) {
            return fileData.id;
          }
        }
      }
    } catch {
      // Игнорируем ошибки разрешения
    }
  }

  // ============================================
  // 3. Прямой поиск в карте
  // ============================================
  const direct = sourceToFileIdMap.get(source);
  if (direct) return direct;

  // ============================================
  // 4. Поиск по basename
  // ============================================
  const sourceBasename = path.basename(source);
  const sourceNoExt = sourceBasename.replace(/\\.[^.]+$/, '');

  for (const [filePath, fileData] of fileMap) {
    const fileBasename = path.basename(filePath);
    const fileNoExt = fileBasename.replace(/\\.[^.]+$/, '');

    if (fileBasename === sourceBasename || fileNoExt === sourceNoExt) {
      return fileData.id;
    }
  }

  // ============================================
  // 5. Внешний пакет
  // ============================================
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
 *
 * @param specifierType — тип specifier из AST
 * @returns Тип импорта
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
 * @param func — функция-источник
 * @param callName — имя вызываемой функции
 * @returns Тип вызова
 */
function detectCallType(
  func: FunctionInfo,
  callName: string
): 'direct' | 'async' | 'method' | 'callback' {
  if (func.isAsync) return 'async';
  if (callName.includes('.')) return 'method';

  const body = func.body || '';
  const cbPattern = new RegExp(`${callName}\\\\s*\\\\([^)]*(?:=>|function)`, 'i');
  if (cbPattern.test(body)) return 'callback';

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
