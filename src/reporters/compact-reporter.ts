// src/reporters/compact-reporter.ts
// ============================================
// ТОНКИЙ ОРКЕСТРАТОР КОМПАКТНОГО ОТЧЁТА
// ============================================
// Вся логика сжатия/разжатия вынесена в ./codec/codec.ts
//
// Что делает этот модуль:
//   1. Собирает FullJSON из entitiesMap (два прохода)
//   2. Вызывает Codec.encode() для получения CompactJSON
//   3. Сохраняет оба файла: compact.json и compact.full.json
//
// Обратная операция:
//   - readAndDecode() — читает compact.json и возвращает FullJSON
//   - decodeCompactReport() — декодирует объект в памяти
//
// Версия: 6.0.1
// ============================================

import fs from 'fs';
import path from 'path';
import type { EntitiesResult } from '../types.js';
import { Codec } from './codec/codec.js';
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
 * @param entitiesMap — карта "путь файла → сущности"
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
    console.log('\n📦 [compact-reporter] Сбор полного JSON...');
  }

  const full = collectFullJSON(entitiesMap, verbose);

  if (verbose) {
    console.log(`   📊 Модулей: ${full.modules.length}`);
    console.log(`   📄 Файлов: ${full.files.length}`);
    console.log(`   ƒ Функций: ${full.functions.length}`);
    console.log(`   📦 Классов: ${full.classes.length}`);
    console.log(`   📌 Констант: ${full.constants.length}`);
    console.log(`   📤 Экспортов: ${full.exports.length}`);
    console.log(`   📥 Импортов: ${full.imports.length}`);
    console.log(`   📞 Вызовов: ${full.calls.length}`);
    console.log(`   🔄 Реэкспортов: ${full.reExports.length}`);
  }

  // ============================================
  // ШАГ 2: Проверка round-trip (опционально, только в verbose)
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
    console.log('✅ [compact-reporter] Готово\n');
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
 * @returns Полный JSON
 */
export function decodeCompactReport(compact: CompactJSON): FullJSON {
  return Codec.decode(compact);
}

/**
 * Читает сжатый JSON из файла и декодирует его.
 *
 * @param compactPath — путь к сжатому JSON
 * @returns Полный JSON
 */
export function readAndDecode(compactPath: string): FullJSON {
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

  return Codec.decode(compact);
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
 * @param entitiesMap — карта "путь файла → сущности"
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
      module.fileIds.push(file.id);
    }

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
  // ВТОРОЙ ПРОХОД: экспорты, импорты, вызовы, реэкспорты
  // ============================================

  for (const [filePath, entities] of Object.entries(entitiesMap)) {
    if (!entities) continue;

    const dirName = path.basename(path.dirname(filePath)) || 'root';
    const module = moduleMap.get(dirName);
    const file = fileMap.get(filePath);

    if (!module || !file) continue;

    // --------------------------------------------
    // Экспорты и реэкспорты
    // --------------------------------------------
    const exportsList = entities.exports || [];

    for (const exp of exportsList) {
      if (!exp || !exp.name) continue;

      // Ищем функцию в глобальной карте
      const funcData = functionMap.get(exp.name);

      if (!funcData) {
        if (verbose && exp.isReExport) {
          console.log(
            `   ⚠️  Реэкспорт '${exp.name}' не найден в functionMap (source: ${exp.source})`
          );
        }
        continue;
      }

      if (exp.isReExport && exp.source) {
        // Реэкспорт
        reExportCounter++;
        reExports.push({
          id: `re${reExportCounter}`,
          moduleId: module.id,
          functionId: funcData.id,
          source: exp.source,
          exportName: exp.name,
          // ✅ ИСПРАВЛЕНО: используем loc?.start?.line, так как у ExportInfo нет поля line
          line: exp.loc?.start?.line || 0,
        });
      } else {
        // Обычный экспорт
        exportCounter++;

        let exportType: 'named' | 'default' | 'type' = 'named';
        if (exp.isDefault) exportType = 'default';
        else if (exp.type === 'type') exportType = 'type';

        exports.push({
          id: `e${exportCounter}`,
          moduleId: module.id,
          functionId: funcData.id,
          exportName: exp.name,
          localName: exp.name,
          // ✅ ИСПРАВЛЕНО: используем loc?.start?.line, так как у ExportInfo нет поля line
          line: exp.loc?.start?.line || 0,
          type: exportType,
          isDefault: exp.isDefault || false,
        });
      }
    }

    // --------------------------------------------
    // Импорты
    // --------------------------------------------
    const importsList = entities.imports || [];

    for (const imp of importsList) {
      if (!imp || !imp.source) continue;

      const specifiers = imp.specifiers || [];

      for (const spec of specifiers) {
        let importedName = '';
        let importType: 'named' | 'default' | 'namespace' | 'type' = 'named';

        if (typeof spec === 'string') {
          importedName = spec;
        } else if (spec && typeof spec === 'object') {
          const specObj = spec as { imported?: string; local?: string; type?: string };
          importedName = specObj.imported || specObj.local || '';

          if (specObj.type === 'ImportDefaultSpecifier') {
            importType = 'default';
          } else if (specObj.type === 'ImportNamespaceSpecifier') {
            importType = 'namespace';
          }
        }

        if (!importedName) continue;

        importCounter++;
        imports.push({
          id: `i${importCounter}`,
          fromFileId: file.id,
          toFileId: null,
          importedName,
          localName: importedName,
          line: imp.loc?.start?.line || 0,
          type: importType,
        });
      }
    }

    // --------------------------------------------
    // Вызовы функций
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
        if (!toFunc) continue;

        // Пропускаем самовызовы
        if (fromFunc.id === toFunc.id) continue;

        callCounter++;
        calls.push({
          id: `c${callCounter}`,
          fromFunctionId: fromFunc.id,
          toFunctionId: toFunc.id,
          line: func.line || 0,
          type: func.isAsync ? 'async' : 'direct',
        });
      }
    }
  }

  if (verbose) {
    console.log(
      `   ✅ Второй проход: ${exports.length} экспортов, ${reExports.length} реэкспортов, ${calls.length} вызовов`
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
    if (file.path.endsWith('src/index.ts') || file.path.endsWith('src\\index.ts')) {
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
    version: '6.0.1',
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

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

export default {
  generateCompactReport,
  decodeCompactReport,
  readAndDecode,
  readFullJson,
};
