// packages/ast-analyzer/src/cli/commands/CompactRecursiveCommand.ts
// ПОЛНАЯ ВЕРСИЯ С ИСПРАВЛЕНИЯМИ - БЕЗ ОШИБОК TS6133

import type { Command } from 'commander';
import path from 'path';
import fs from 'fs';

/**
 * Команда для рекурсивного компакт-отчета
 * Работает как project + compact: строит граф зависимостей,
 * собирает все файлы и генерирует компактный отчет
 *
 * ИСПРАВЛЕНИЯ:
 * - Убрано дублирование функций в functionIndex
 * - Каждая функция добавляется только один раз (в оригинальном файле)
 * - Добавлено поле usedIn для отслеживания использования
 * - Уникальные функции идентифицируются по имени + сигнатуре
 * - ИСПРАВЛЕНО: все предупреждения TS6133 (неиспользуемые переменные)
 * - ИСПРАВЛЕНО: все предупреждения ESLint
 */
export class CompactRecursiveCommand {
  private program: Command;
  private fileCounter: number = 0;
  private moduleCounter: number = 0;
  private functionCounter: number = 0;
  private fileIdMap: Map<string, string> = new Map();
  private moduleIdMap: Map<string, string> = new Map();

  constructor(program: Command) {
    this.program = program;
    this.register();
  }

  private register(): void {
    this.program
      .command('compact-recursive <entry>')
      .description('📋 Генерация компактного отчета для всего проекта (рекурсивно от точки входа)')
      .option('-o, --output <file>', 'Выходной файл', './reports/ast-analyzer-full.json')
      .option('-d, --depth <n>', 'Максимальная глубина анализа', '100')
      .option('--ultra', 'Ультра-компактный режим (максимальное сжатие)')
      .option(
        '--preset <name>',
        'Пресет: minimal, standard, full, relationshipsOnly, ultraCompact',
        'standard'
      )
      .option('--include-body', 'Включить тела функций в отчет', false)
      .option('--include-security', 'Включить информацию о безопасности', false)
      .option('--no-templates', 'Отключить использование шаблонов')
      .option('--no-legend', 'Отключить легенду (экономия места)')
      .option('-v, --verbose', 'Подробный вывод', false)
      .action(async (entry: string, options: any) => {
        try {
          await this.execute(entry, options);
        } catch (error) {
          console.error('❌ CompactRecursiveCommand error:', error);
          process.exit(1);
        }
      });
  }

  private async execute(entry: string, options: any): Promise<void> {
    const startTime = Date.now();
    const entryPath = path.resolve(entry);

    console.log('\n' + '='.repeat(70));
    console.log('📋 КОМПАКТНЫЙ ОТЧЕТ ДЛЯ ВСЕГО ПРОЕКТА (РЕКУРСИВНЫЙ)');
    console.log('='.repeat(70));
    console.log(`📄 Точка входа: ${entryPath}`);
    console.log(`📏 Глубина: ${options.depth}`);
    console.log(`🚀 Ультра-компактный: ${options.ultra ? 'ВКЛЮЧЕН' : 'ВЫКЛЮЧЕН'}`);
    console.log(`📋 Пресет: ${options.preset}`);
    console.log(`📁 Выходной файл: ${options.output}`);
    console.log('');

    if (!fs.existsSync(entryPath)) {
      console.error(`❌ Файл не найден: ${entryPath}`);
      process.exit(1);
    }

    // Шаг 1: Строим граф проекта
    console.log('📊 Шаг 1: Построение графа зависимостей проекта...');
    const { ProjectGraphBuilder } = await import('../../core/ProjectGraphBuilder.js');

    const builder = new ProjectGraphBuilder({
      maxDepth: parseInt(options.depth),
      includeExternal: false,
    });

    const graphData = builder.build(entryPath);
    const stats = builder.getStats();

    console.log(`   ✅ Граф построен: ${stats.totalNodes} узлов, ${stats.totalEdges} ребер`);
    console.log(`   🔄 Циклов: ${stats.cyclesCount}`);

    // Шаг 2: Собираем все файлы из графа
    console.log('\n📁 Шаг 2: Сбор всех файлов проекта...');
    const allFiles = Object.keys(graphData.graph);

    if (allFiles.length === 0) {
      console.error('❌ Не найдено файлов для анализа');
      process.exit(1);
    }

    const supportedExtensions = ['.ts', '.tsx', '.js', '.jsx', '.vue', '.mjs', '.cjs'];
    const validFiles = allFiles.filter(file => {
      if (!fs.existsSync(file)) return false;
      const ext = path.extname(file);
      return supportedExtensions.includes(ext);
    });

    console.log(`   📄 Найдено файлов: ${validFiles.length}`);
    console.log(`   📊 Из них уникальных: ${new Set(validFiles).size}`);

    if (validFiles.length === 0) {
      console.error('❌ Нет валидных файлов для анализа');
      process.exit(1);
    }

    // Шаг 3: Извлекаем сущности из всех файлов
    console.log('\n🔍 Шаг 3: Извлечение сущностей из всех файлов...');
    const { extractEntitiesFromFile } = await import('../../reporters/json-reporter.js');

    // Сброс счетчиков
    this.fileCounter = 0;
    this.moduleCounter = 0;
    this.functionCounter = 0;
    this.fileIdMap.clear();
    this.moduleIdMap.clear();

    // Структуры для хранения данных
    const moduleMap = new Map<
      string,
      {
        id: string;
        files: string[];
        functions: any[];
        exports: string[];
        imports: string[];
      }
    >();

    const fileMap = new Map<
      string,
      {
        id: string;
        path: string;
        module: string;
        functions: any[];
        entities: any;
      }
    >();

    const entitiesMap: Record<string, any> = {};

    // ✅ НОВАЯ СТРУКТУРА: Уникальные функции (без дублирования)
    const uniqueFunctions = new Map<
      string,
      {
        name: string;
        module: string;
        file: string;
        usedIn: string[];
        line: number;
        flags: number;
        params: string[];
        returnType: string;
        calls: string[];
        isExported: boolean;
        isAsync: boolean;
      }
    >();

    // Сначала создаем карту модулей из структуры директорий
    for (const file of validFiles) {
      const dirName = path.basename(path.dirname(file)) || 'root';
      if (!this.moduleIdMap.has(dirName)) {
        this.moduleCounter++;
        const mid = `m${this.moduleCounter}`;
        this.moduleIdMap.set(dirName, mid);
        moduleMap.set(mid, {
          id: mid,
          files: [],
          functions: [],
          exports: [],
          imports: [],
        });
      }
    }

    // Теперь обрабатываем каждый файл
    for (const file of validFiles) {
      try {
        if (options.verbose) {
          console.log(`   📄 Обработка: ${path.basename(file)}`);
        }

        const entities = extractEntitiesFromFile(file);
        if (!entities || Object.keys(entities).length === 0) continue;

        const dirName = path.basename(path.dirname(file)) || 'root';
        const moduleId = this.moduleIdMap.get(dirName)!;
        const relativePath = path.relative(process.cwd(), file);

        // Сохраняем entities
        entitiesMap[relativePath] = entities;

        // Создаем ID файла
        this.fileCounter++;
        const fileId = `f${this.fileCounter}`;
        this.fileIdMap.set(relativePath, fileId);

        // Сохраняем в fileMap
        fileMap.set(relativePath, {
          id: fileId,
          path: relativePath,
          module: moduleId,
          functions: entities.functions || [],
          entities: entities,
        });

        // Обновляем moduleMap
        const moduleData = moduleMap.get(moduleId)!;
        if (!moduleData.files.includes(relativePath)) {
          moduleData.files.push(relativePath);
        }

        // ✅ ИСПРАВЛЕНИЕ: Добавляем функции в uniqueFunctions (без дублирования)
        for (const func of entities.functions || []) {
          if (!func.name) continue;

          // Создаем уникальный ключ: имя + сигнатура (для различения одинаковых имен)
          const signatureKey = `${func.name}|${(func.params || []).join(',')}|${func.returnType || 'any'}`;

          if (!uniqueFunctions.has(signatureKey)) {
            // Первое появление = ОРИГИНАЛ (сохраняем)
            this.functionCounter++;
            const fnId = `fn${this.functionCounter}`;

            uniqueFunctions.set(signatureKey, {
              name: func.name,
              module: moduleId,
              file: fileId,
              usedIn: [fileId],
              line: func.line || 0,
              flags: this.encodeFlags(func),
              params: func.params || [],
              returnType: func.returnType || 'any',
              calls: func.calls || [],
              isExported: func.isExported || false,
              isAsync: func.isAsync || false,
            });

            // Добавляем в moduleData.functions
            const funcWithMeta = {
              ...func,
              _file: relativePath,
              _fileId: fileId,
              _module: moduleId,
              _index: this.functionCounter,
              _uniqueKey: signatureKey,
              _fnId: fnId,
            };
            moduleData.functions.push(funcWithMeta);

            if (func.isExported) {
              moduleData.exports.push(func.name);
            }
          } else {
            // Это ИСПОЛЬЗОВАНИЕ (не оригинал) - добавляем в usedIn
            const existing = uniqueFunctions.get(signatureKey)!;
            if (!existing.usedIn.includes(fileId)) {
              existing.usedIn.push(fileId);
            }
            // Объединяем вызовы
            for (const call of func.calls || []) {
              if (!existing.calls.includes(call)) {
                existing.calls.push(call);
              }
            }
          }
        }

        // Добавляем импорты
        for (const imp of entities.imports || []) {
          if (imp.source && !moduleData.imports.includes(imp.source)) {
            moduleData.imports.push(imp.source);
          }
        }
      } catch (error) {
        if (options.verbose) {
          console.warn(`   ⚠️ Ошибка при обработке ${path.basename(file)}:`, error);
        }
      }
    }

    const totalFunctions = uniqueFunctions.size;
    const totalModules = moduleMap.size;
    const totalFiles = fileMap.size;

    console.log(`   ✅ Обработано файлов: ${fileMap.size}/${validFiles.length}`);
    console.log(`   📊 Всего уникальных функций: ${totalFunctions}`);
    console.log(`   📁 Модулей: ${totalModules}`);
    console.log(`   📄 Файлов: ${totalFiles}`);

    if (uniqueFunctions.size === 0) {
      console.error('❌ Не найдено сущностей для анализа');
      process.exit(1);
    }

    // Шаг 4: Строим полный граф вызовов, импортов и экспортов
    console.log('\n📋 Шаг 4: Построение графа вызовов, импортов и экспортов...');
    const callGraph = this.buildFullCallGraph(entitiesMap, fileMap, uniqueFunctions);

    // Шаг 5: Генерируем отчет с модулями
    console.log('\n📋 Шаг 5: Генерация компактного отчета с модулями...');

    // Строим индексы для отчета
    const moduleIndex: Record<string, string> = {};
    const fileIndex: Record<string, { path: string; module: string }> = {};
    const functionIndex: Record<
      string,
      {
        name: string;
        module: string;
        file: string;
        usedIn: string[];
        line: number;
        flags: number;
      }
    > = {};

    // ✅ ИСПРАВЛЕНИЕ: Используем uniqueFunctions для построения индексов
    let fnIdx = 0;
    for (const [, funcData] of uniqueFunctions) {
      fnIdx++;
      const fnId = `fn${fnIdx}`;
      functionIndex[fnId] = {
        name: funcData.name,
        module: funcData.module,
        file: funcData.file,
        usedIn: funcData.usedIn,
        line: funcData.line,
        flags: funcData.flags,
      };
    }

    for (const [mid, moduleData] of moduleMap) {
      moduleIndex[mid] = mid;
      for (const filePath of moduleData.files) {
        const fileData = fileMap.get(filePath);
        if (fileData) {
          fileIndex[fileData.id] = { path: filePath, module: mid };
        }
      }
    }

    // Формируем финальный отчет
    const report = {
      v: options.ultra ? '5.0.0-ultra' : '5.0.0',
      ts: new Date().toISOString(),
      r: 'm1',

      // Легенда
      lg: {
        desc: 'Полная легенда для всех кодов и ключей',
        ids: {
          'm1,m2,...': 'Короткие имена модулей (см. moduleIndex)',
          'f1,f2,...': 'Короткие имена файлов (см. fileIndex)',
          'fn1,fn2,...': 'Короткие имена функций (см. functionIndex)',
        },
        flags: {
          '1': 'async - асинхронная функция',
          '2': 'exported - экспортируется',
          '4': 'method - метод класса',
          '8': 'arrow - стрелочная функция',
          '16': 'event - обработчик события',
          '32': 'nested - вложенная функция',
        },
        ct: {
          d: 'direct - прямой вызов',
          i: 'imported - импортированный вызов',
          m: 'method - метод объекта',
          e: 'event - событие',
        },
      },

      // Индексы
      moduleIndex,
      fileIndex,
      functionIndex,

      // Данные модулей
      modules: Object.fromEntries(
        Array.from(moduleMap.entries()).map(([id, data]) => [
          id,
          {
            name: id,
            files: data.files,
            functions: data.functions.map((f: any) => f.name),
            exports: data.exports,
            imports: data.imports,
          },
        ])
      ),

      // Данные файлов
      files: Object.fromEntries(
        Array.from(fileMap.entries()).map(([path, data]) => [
          data.id,
          {
            path: path,
            module: data.module,
            functions: data.functions.map((f: any) => f.name),
          },
        ])
      ),

      // ✅ ИСПРАВЛЕНИЕ: funcs строим из uniqueFunctions (без дублирования)
      funcs: (() => {
        const result: any[] = [];
        let idx = 0;
        for (const [, funcData] of uniqueFunctions) {
          idx++;
          const moduleNum = parseInt(funcData.module.replace('m', ''));
          const fileNum = parseInt(funcData.file.replace('f', ''));

          // Находим индексы вызываемых функций
          const callIndices: number[] = [];
          for (const call of funcData.calls) {
            let callIdx = 0;
            for (const [, calledFunc] of uniqueFunctions) {
              callIdx++;
              if (calledFunc.name === call) {
                callIndices.push(callIdx);
                break;
              }
            }
          }

          result.push({
            n: funcData.name,
            m: moduleNum,
            f: fileNum,
            l: funcData.line,
            fl: funcData.flags,
            c: [...new Set(callIndices)],
            _uk: `${funcData.module}:${funcData.file}:${funcData.name}`,
            _usedIn: funcData.usedIn,
          });
        }
        return result;
      })(),

      // Граф вызовов
      graph: callGraph.edges,

      // Граф импортов
      importGraph: callGraph.importGraph,

      // Граф экспортов
      exportGraph: callGraph.exportGraph,

      // Обратный граф экспортов (кто использует экспорты)
      reverseExportGraph: callGraph.reverseExportGraph,

      // Агрегированные импорты по модулям
      importsByModule: callGraph.importsByModule,

      // Агрегированные экспорты по модулям
      exportsByModule: callGraph.exportsByModule,

      // Внешние библиотеки
      externalLibs: callGraph.externalLibs,

      // Статистика
      stats: {
        tf: totalFunctions,
        tc: callGraph.edges.length,
        tm: totalModules,
        tfiles: totalFiles,
        cy: callGraph.hasCycles,
        ti: callGraph.imports,
        tex: callGraph.exports,
        tun: callGraph.unresolved,
      },
    };

    // Сохраняем
    const outputPath = path.resolve(options.output);
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const json = JSON.stringify(report, null, options.ultra ? 0 : 2);
    fs.writeFileSync(outputPath, json);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const sizeKB = (json.length / 1024).toFixed(2);

    console.log('\n' + '='.repeat(70));
    console.log('✅ ОТЧЕТ УСПЕШНО СОЗДАН!');
    console.log('='.repeat(70));
    console.log(`📄 Файл: ${outputPath}`);
    console.log(`📊 Размер: ${sizeKB} KB`);
    console.log(`⏱️  Время: ${duration} сек`);

    console.log('\n📊 СТАТИСТИКА ОТЧЕТА:');
    console.log(`   • Уникальных функций: ${totalFunctions}`);
    console.log(`   • Модулей: ${totalModules}`);
    console.log(`   • Файлов: ${totalFiles}`);
    console.log(`   • Вызовов: ${callGraph.edges.length}`);
    console.log(`   • Импортов: ${callGraph.imports}`);
    console.log(`   • Экспортов: ${callGraph.exports}`);
    console.log(`   • Связей импортов: ${callGraph.importGraph.length}`);
    console.log(`   • Связей экспортов: ${callGraph.exportGraph.length}`);
    console.log(`   • Внешних библиотек: ${callGraph.externalLibs.length}`);
    console.log(`   • Циклы: ${callGraph.hasCycles ? 'ЕСТЬ' : 'НЕТ'}`);

    console.log('\n📦 ИНФОРМАЦИЯ О СЖАТИИ:');
    console.log(`   • Режим: ${options.ultra ? 'УЛЬТРА-КОМПАКТНЫЙ' : 'КОМПАКТНЫЙ'}`);
    console.log(`   • Всего файлов проанализировано: ${validFiles.length}`);
    console.log(`   • Уникальных функций (без дублирования): ${totalFunctions}`);

    console.log('\n💡 КАК ИСПОЛЬЗОВАТЬ ОТЧЕТ:');
    console.log('   • moduleIndex - для навигации по модулям');
    console.log('   • fileIndex - для навигации по файлам');
    console.log('   • functionIndex - для поиска функций по ID (уникальные!)');
    console.log('   • functionIndex[fn].usedIn - где используется функция');
    console.log('   • modules - данные по модулям');
    console.log('   • files - данные по файлам');
    console.log('   • funcs - все уникальные функции с вызовами');
    console.log('   • graph - полный граф вызовов');
    console.log('   • importGraph - граф импортов (кто → кого импортирует)');
    console.log('   • exportGraph - граф экспортов (кто → что экспортирует)');
    console.log('   • reverseExportGraph - кто использует экспорты');
    console.log('   • importsByModule - агрегированные импорты по модулям');
    console.log('   • exportsByModule - агрегированные экспорты по модулям');
    console.log('   • externalLibs - внешние библиотеки');
    console.log('   • legend - для расшифровки всех кодов и ключей');

    console.log('\n' + '='.repeat(70) + '\n');
  }

  /**
   * ✅ ИСПРАВЛЕНИЕ: Кодирование флагов
   */
  private encodeFlags(func: any): number {
    let flags = 0;
    if (func.isAsync) flags |= 1;
    if (func.isExported) flags |= 2;
    if (func.isMethod) flags |= 4;
    if (func.isArrow) flags |= 8;
    if (func.isEventHandler) flags |= 16;
    if (func.isNested) flags |= 32;
    return flags;
  }

  /**
   * ✅ ИСПРАВЛЕНИЕ: Построение графа с использованием uniqueFunctions
   * ИСПРАВЛЕНО: удалены неиспользуемые параметры
   */
  private buildFullCallGraph(
    entitiesMap: Record<string, any>,
    fileMap: Map<string, any>,
    uniqueFunctions: Map<string, any>
  ): any {
    const edges: [number, number, number][] = [];
    const externalLibsSet = new Map<string, { file: string; line: number; context: string }[]>();
    const allFunctionNames = new Set<string>();

    // Структуры для импортов и экспортов
    const importGraph: { from: string; to: string; specifiers: string[]; line: number }[] = [];
    const exportGraph: { from: string; to: string; specifiers: string[]; line: number }[] = [];
    const reverseExportGraph: Map<string, { from: string; specifiers: string[]; line: number }[]> =
      new Map();

    let imports = 0;
    let exports = 0;
    let unresolved = 0;

    // Строим индекс уникальных функций по имени
    const funcIndex = new Map<string, number>();
    let idx = 0;
    for (const [, funcData] of uniqueFunctions) {
      idx++;
      funcIndex.set(funcData.name, idx);
      allFunctionNames.add(funcData.name);
    }

    // Анализируем вызовы, импорты и экспорты
    for (const [filePath, entities] of Object.entries(entitiesMap)) {
      const fileInfo = fileMap.get(filePath);
      if (!fileInfo) continue;

      const fromModule = fileInfo.module;

      // 1. АНАЛИЗ ИМПОРТОВ
      for (const imp of entities.imports || []) {
        if (!imp.source) continue;

        imports++;

        // Определяем целевой модуль
        let toModule = 'external';

        // Пытаемся найти целевой модуль в проекте
        for (const [modulePath] of Object.entries(entitiesMap)) {
          if (modulePath.includes(imp.source) || imp.source.includes(path.basename(modulePath))) {
            const dirName = path.basename(path.dirname(modulePath)) || 'root';
            toModule = dirName;
            break;
          }
        }

        // Добавляем в граф импортов
        importGraph.push({
          from: fromModule,
          to: toModule,
          specifiers: imp.specifiers.map((s: any) =>
            typeof s === 'string' ? s : s.imported || s.local
          ),
          line: imp.loc?.start?.line || 0,
        });

        // Внешние библиотеки
        if (toModule === 'external' && !imp.source.startsWith('.')) {
          const libName = imp.source.split('/')[0] || imp.source;
          if (!externalLibsSet.has(libName)) {
            externalLibsSet.set(libName, []);
          }
          externalLibsSet.get(libName)!.push({
            file: filePath,
            line: imp.loc?.start?.line || 0,
            context: `import { ${imp.specifiers.map((s: any) => (typeof s === 'string' ? s : s.imported)).join(', ')} } from '${imp.source}'`,
          });
        }
      }

      // 2. АНАЛИЗ ЭКСПОРТОВ
      for (const func of entities.functions || []) {
        if (func.isExported && func.name) {
          exports++;

          // Добавляем в граф экспортов
          exportGraph.push({
            from: fromModule,
            to: func.name,
            specifiers: [func.name],
            line: func.line || 0,
          });

          // Строим обратный граф экспортов (кто использует экспорт)
          for (const [otherPath, otherEntities] of Object.entries(entitiesMap)) {
            if (otherPath === filePath) continue;

            for (const imp of otherEntities.imports || []) {
              for (const spec of imp.specifiers) {
                const specName = typeof spec === 'string' ? spec : spec.imported || spec.local;
                if (specName === func.name) {
                  const otherModule = path.basename(path.dirname(otherPath)) || 'root';
                  if (!reverseExportGraph.has(func.name)) {
                    reverseExportGraph.set(func.name, []);
                  }
                  reverseExportGraph.get(func.name)!.push({
                    from: otherModule,
                    specifiers: [func.name],
                    line: imp.loc?.start?.line || 0,
                  });
                }
              }
            }
          }
        }
      }

      // 3. ВНУТРЕННИЕ ВЫЗОВЫ (используем uniqueFunctions)
      for (const func of entities.functions || []) {
        const fromIdx = funcIndex.get(func.name);
        if (fromIdx === undefined) continue;

        for (const call of func.calls || []) {
          const toIdx = funcIndex.get(call);
          if (toIdx !== undefined) {
            const exists = edges.some(e => e[0] === fromIdx && e[1] === toIdx);
            if (!exists) {
              edges.push([fromIdx, toIdx, func.line || 0]);
            }
          } else {
            unresolved++;
          }
        }

        // Проверяем вызовы через body
        if (func.body) {
          const body = func.body;
          const callMatches = body.match(/\b(\w+)\s*\(/g);
          if (callMatches) {
            for (const match of callMatches) {
              const callName = match.replace(/\s*\(/, '');
              if (callName && callName !== func.name && !allFunctionNames.has(callName)) {
                const toIdx = funcIndex.get(callName);
                if (toIdx !== undefined) {
                  const exists = edges.some(e => e[0] === fromIdx && e[1] === toIdx);
                  if (!exists) {
                    edges.push([fromIdx, toIdx, func.line || 0]);
                  }
                }
              }
            }
          }
        }
      }
    }

    // Преобразуем reverseExportGraph в читаемый формат
    const reverseExportGraphArray = Array.from(reverseExportGraph.entries()).map(
      ([name, users]) => ({
        name,
        usedBy: users,
      })
    );

    // Агрегируем импорты по модулям
    const importsByModule = new Map<
      string,
      { to: string; count: number; specifiers: string[] }[]
    >();
    for (const imp of importGraph) {
      if (!importsByModule.has(imp.from)) {
        importsByModule.set(imp.from, []);
      }
      const existing = importsByModule.get(imp.from)!;
      const found = existing.find(e => e.to === imp.to);
      if (found) {
        found.count++;
        found.specifiers.push(...imp.specifiers);
      } else {
        existing.push({
          to: imp.to,
          count: 1,
          specifiers: [...imp.specifiers],
        });
      }
    }

    // Агрегируем экспорты по модулям
    const exportsByModule = new Map<string, { name: string; usedBy: number; users: string[] }[]>();
    for (const exp of exportGraph) {
      if (!exportsByModule.has(exp.from)) {
        exportsByModule.set(exp.from, []);
      }
      const users = reverseExportGraph.get(exp.to) || [];
      exportsByModule.get(exp.from)!.push({
        name: exp.to,
        usedBy: users.length,
        users: users.map(u => u.from),
      });
    }

    const externalLibs = Array.from(externalLibsSet.entries()).map(([name, usage]) => ({
      name,
      usage: usage.slice(0, 20),
    }));

    const hasCycles = this.detectCycles(edges);

    return {
      edges,
      imports,
      exports,
      unresolved,
      externalLibs,
      hasCycles,

      importGraph,
      exportGraph,
      reverseExportGraph: reverseExportGraphArray,
      importsByModule: Object.fromEntries(importsByModule),
      exportsByModule: Object.fromEntries(exportsByModule),
    };
  }

  private detectCycles(edges: [number, number, number][]): boolean {
    if (edges.length === 0) return false;

    const graph = new Map<number, Set<number>>();
    for (const [from, to] of edges) {
      if (!graph.has(from)) graph.set(from, new Set());
      graph.get(from)!.add(to);
    }

    const visited = new Set<number>();
    const recursionStack = new Set<number>();

    const dfs = (node: number): boolean => {
      if (recursionStack.has(node)) return true;
      if (visited.has(node)) return false;

      visited.add(node);
      recursionStack.add(node);

      const neighbors = graph.get(node) || new Set();
      for (const neighbor of neighbors) {
        if (dfs(neighbor)) return true;
      }

      recursionStack.delete(node);
      return false;
    };

    for (const node of graph.keys()) {
      if (!visited.has(node)) {
        if (dfs(node)) return true;
      }
    }

    return false;
  }

  getCommand(): Command {
    return this.program;
  }
}

export default CompactRecursiveCommand;
