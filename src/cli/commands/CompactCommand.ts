// packages/ast-analyzer/src/cli/commands/CompactCommand.ts
// ПОЛНАЯ ВЕРСИЯ С ОБНОВЛЕНИЯМИ - ДОБАВЛЕНА ПОДДЕРЖКА SELF FUNCTIONS

import type { Command } from 'commander';
import path from 'path';
import fs from 'fs';
import { glob } from 'glob';

/**
 * Команда для генерации компактного отчета сущностей
 *
 * Особенности:
 * - Минимизированные ключи (экономия до 45% размера)
 * - Короткие ID (m1, f1, fn1, sf1, ...)
 * - Битовые флаги вместо булевых полей
 * - Словари для параметров и типов
 * - Ультра-компактный режим (максимальное сжатие)
 * - Поддержка шаблонов для повторяющихся структур
 * - Полная легенда для всех кодов и ключей
 * - Self functions — изолированные функции (не вызывают и не вызываются)
 */
export class CompactCommand {
  private program: Command;

  constructor(program: Command) {
    this.program = program;
    this.register();
  }

  private register(): void {
    this.program
      .command('compact <paths...>')
      .description('📋 Генерация компактного отчета сущностей с минимизированными ключами')
      .option('-o, --output <file>', 'Выходной файл', 'entities.json')
      .option('-r, --recursive', 'Рекурсивный поиск файлов', true)
      .option('--ultra', 'Ультра-компактный режим (максимальное сжатие, экономия ~70%)')
      .option('--no-bit-flags', 'Отключить битовые флаги (использовать полные булевы поля)')
      .option('--no-dictionaries', 'Отключить словари для параметров и типов')
      .option('--minify-keys', 'Минифицировать ключи (более короткие имена)')
      .option('--max-depth <n>', 'Максимальная глубина анализа', '10')
      .option(
        '--preset <name>',
        'Пресет: minimal, standard, full, relationshipsOnly, ultraCompact',
        'standard'
      )
      .option('--include-body', 'Включить тела функций в отчет', false)
      .option('--include-security', 'Включить информацию о безопасности', false)
      .option('--no-templates', 'Отключить использование шаблонов')
      .option('--no-legend', 'Отключить легенду (экономия места)')
      .option(
        '--no-self-functions',
        'Отключить секцию self functions (изолированные функции)',
        false
      )
      .option('-v, --verbose', 'Подробный вывод', false)
      .action(async (paths: string[], options: any) => {
        try {
          await this.execute(paths, options);
        } catch (error) {
          console.error('❌ Compact report generation failed:', error);
          process.exit(1);
        }
      });
  }

  private async execute(paths: string[], options: any): Promise<void> {
    console.log('\n' + '='.repeat(70));
    console.log('📋 ГЕНЕРАЦИЯ КОМПАКТНОГО ОТЧЕТА СУЩНОСТЕЙ');
    console.log('='.repeat(70));
    console.log(`📁 Пути: ${paths.join(', ')}`);
    console.log(`📄 Выходной файл: ${options.output}`);
    console.log(`🚀 Ультра-компактный режим: ${options.ultra ? 'ВКЛЮЧЕН' : 'ВЫКЛЮЧЕН'}`);
    console.log(`📋 Пресет: ${options.preset}`);
    console.log(`📏 Глубина: ${options.maxDepth}`);
    console.log(`📝 Включить тела функций: ${options.includeBody ? 'ДА' : 'НЕТ'}`);
    console.log(`🔒 Информация о безопасности: ${options.includeSecurity ? 'ДА' : 'НЕТ'}`);
    console.log(`🔍 Self functions: ${options.selfFunctions !== false ? 'ВКЛЮЧЕНЫ' : 'ВЫКЛЮЧЕНЫ'}`);
    console.log('');

    // Проверяем пресет
    const presets = ['minimal', 'standard', 'full', 'relationshipsOnly', 'ultraCompact'];
    if (!presets.includes(options.preset)) {
      console.warn(`⚠️ Неизвестный пресет: ${options.preset}, используем 'standard'`);
    }

    // Собираем файлы
    const files = await this.collectFiles(paths, options.recursive);

    if (files.length === 0) {
      console.error('❌ Не найдено файлов для анализа');
      process.exit(1);
    }

    console.log(`📊 Найдено файлов: ${files.length}`);
    console.log('');

    const outputPath = path.resolve(options.output);
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    try {
      // Импортируем только generateCompactReport
      const { generateCompactReport } = await import('../../reporters/compact-reporter.js');
      const { parseFile } = await import('../../core/ast-parser.js');
      const { extractEntities } = await import('../../core/entity-extractor.js');

      // Собираем сущности из всех файлов
      const entitiesMap: Record<string, any> = {};
      let totalFunctions = 0;
      let totalClasses = 0;
      let totalConstants = 0;
      let totalSelfFunctions = 0;

      for (const filePath of files) {
        if (options.verbose) {
          console.log(`   📄 Обработка: ${path.basename(filePath)}`);
        }

        try {
          const parsed = parseFile(filePath);
          if (!parsed) {
            if (options.verbose) {
              console.warn(`   ⚠️ Не удалось распарсить: ${path.basename(filePath)}`);
            }
            continue;
          }

          const entities = extractEntities(parsed.ast, filePath);
          if (entities && Object.keys(entities).length > 0) {
            const relativePath = path.relative(process.cwd(), filePath);
            entitiesMap[relativePath] = entities;

            totalFunctions += entities.functions?.length || 0;
            totalClasses += entities.classes?.length || 0;
            totalConstants += entities.constants?.length || 0;

            // Подсчет self functions (функции без вызовов)
            if (options.selfFunctions !== false) {
              for (const func of entities.functions || []) {
                const hasCalls = func.calls && func.calls.length > 0;
                const hasCalledBy = func.calledBy && func.calledBy.length > 0;
                if (!hasCalls && !hasCalledBy) {
                  totalSelfFunctions++;
                }
              }
            }
          }
        } catch (error) {
          console.warn(`   ⚠️ Ошибка при обработке ${path.basename(filePath)}:`, error);
        }
      }

      if (Object.keys(entitiesMap).length === 0) {
        console.error('❌ Не найдено сущностей для анализа');
        process.exit(1);
      }

      console.log(`📊 Собрано сущностей:`);
      console.log(`   • Файлов: ${Object.keys(entitiesMap).length}`);
      console.log(`   • Функций: ${totalFunctions}`);
      console.log(`   • Классов: ${totalClasses}`);
      console.log(`   • Констант: ${totalConstants}`);
      if (options.selfFunctions !== false) {
        console.log(`   • Self функций: ${totalSelfFunctions}`);
      }
      console.log('');

      // Формируем опции для генератора
      const reportOptions = {
        useBitFlags: options.bitFlags !== false,
        useDictionaries: options.dictionaries !== false,
        readableKeys: !options.minifyKeys,
        useTemplates: options.templates !== false,
        maxDepth: parseInt(options.maxDepth),
        includeBody: options.includeBody,
        includeSecurity: options.includeSecurity,
        includeRelations: true,
        includeStats: true,
        includeTypes: true,
        includeInheritance: true,
        includeExports: true,
        includeConstants: true,
        includeSelfFunctions: options.selfFunctions !== false, // ✅ НОВАЯ ОПЦИЯ
        ultraCompact: options.ultra || false,
      };

      // Генерируем отчет (единая функция для всех режимов)
      console.log(`📋 Генерация ${options.ultra ? 'ультра-компактного' : 'компактного'} отчета...`);
      const startTime = Date.now();
      const report = generateCompactReport(entitiesMap, outputPath, reportOptions);
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      // Выводим результаты
      this.printResults(report, outputPath, duration, options);

      // Сохраняем дополнительную информацию в verbose режиме
      if (options.verbose) {
        this.saveVerboseInfo(report, outputDir, entitiesMap);
      }
    } catch (error) {
      console.error('❌ Ошибка при генерации отчета:', error);
      if (options.verbose && error instanceof Error && error.stack) {
        console.error('\n📚 Стек ошибки:');
        console.error(error.stack);
      }
      process.exit(1);
    }
  }

  private async collectFiles(paths: string[], recursive: boolean): Promise<string[]> {
    const files: string[] = [];
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.vue'];

    for (const inputPath of paths) {
      const resolvedPath = path.resolve(inputPath);

      if (!fs.existsSync(resolvedPath)) {
        console.warn(`⚠️ Путь не существует: ${inputPath}`);
        continue;
      }

      const stat = fs.statSync(resolvedPath);

      if (stat.isFile()) {
        if (extensions.includes(path.extname(resolvedPath))) {
          files.push(resolvedPath);
        }
      } else if (stat.isDirectory()) {
        const pattern = recursive
          ? `${resolvedPath}/**/*{${extensions.join(',')}}`
          : `${resolvedPath}/*{${extensions.join(',')}}`;

        try {
          const matched = await glob(pattern, {
            nodir: true,
            ignore: [
              '**/node_modules/**',
              '**/dist/**',
              '**/build/**',
              '**/coverage/**',
              '**/*.d.ts',
              '**/*.test.ts',
              '**/*.spec.ts',
              '**/*.test.js',
              '**/*.spec.js',
            ],
            absolute: true,
          });
          files.push(...matched);
        } catch (error) {
          console.warn(`⚠️ Ошибка при сканировании ${resolvedPath}:`, error);
        }
      }
    }

    return [...new Set(files)];
  }

  private printResults(report: any, outputPath: string, duration: string, options: any): void {
    const sizeKB = (JSON.stringify(report).length / 1024).toFixed(2);

    console.log('\n' + '='.repeat(70));
    console.log('✅ ОТЧЕТ УСПЕШНО СОЗДАН!');
    console.log('='.repeat(70));
    console.log(`📄 Файл: ${outputPath}`);
    console.log(`📊 Размер: ${sizeKB} KB`);
    console.log(`⏱️  Время: ${duration} сек`);

    console.log('\n📊 СТАТИСТИКА ОТЧЕТА:');
    if (report.st) {
      console.log(`   • Модулей: ${report.st.tm || 0}`);
      console.log(`   • Файлов: ${report.st.tfils || 0}`);
      console.log(`   • Функций: ${report.st.tf || 0}`);
      console.log(`   • Self функций: ${report.st.tsf || 0}`); // ✅
      console.log(`   • Вызовов: ${report.st.tc || 0}`);
      console.log(`   • Импортов: ${report.st.ti || 0}`);
      console.log(`   • Экспортов: ${report.st.te || 0}`);
      console.log(`   • Неиспользуемых: ${report.st.tun || 0}`);
      console.log(`   • Констант: ${report.st.tcn || 0}`);
      console.log(`   • Циклов: ${report.st.cy ? 'ЕСТЬ' : 'НЕТ'}`);
    }

    console.log('\n📦 ИНФОРМАЦИЯ О СЖАТИИ:');
    console.log(`   • Режим: ${options.ultra ? 'УЛЬТРА-КОМПАКТНЫЙ' : 'КОМПАКТНЫЙ'}`);
    console.log(`   • Битовые флаги: ${options.bitFlags !== false ? 'ВКЛЮЧЕНЫ' : 'ВЫКЛЮЧЕНЫ'}`);
    console.log(`   • Словари: ${options.dictionaries !== false ? 'ВКЛЮЧЕНЫ' : 'ВЫКЛЮЧЕНЫ'}`);
    console.log(`   • Минификация ключей: ${options.minifyKeys ? 'ВКЛЮЧЕНА' : 'ВЫКЛЮЧЕНА'}`);
    console.log(`   • Шаблоны: ${options.templates !== false ? 'ВКЛЮЧЕНЫ' : 'ВЫКЛЮЧЕНЫ'}`);
    console.log(`   • Легенда: ${options.legend !== false ? 'ВКЛЮЧЕНА' : 'ВЫКЛЮЧЕНА'}`);
    console.log(
      `   • Self functions: ${options.selfFunctions !== false ? 'ВКЛЮЧЕНЫ' : 'ВЫКЛЮЧЕНЫ'}`
    );

    if (report.legend && options.legend !== false) {
      console.log('\n📖 ЛЕГЕНДА (кратко):');
      const legendKeys = Object.keys(report.legend).slice(0, 5);
      for (const key of legendKeys) {
        const desc = report.legend[key];
        if (typeof desc === 'string') {
          console.log(`   • ${key}: ${desc.substring(0, 60)}${desc.length > 60 ? '...' : ''}`);
        }
      }
      if (Object.keys(report.legend).length > 5) {
        console.log(`   ... и ещё ${Object.keys(report.legend).length - 5} ключей`);
      }
    }

    // Self functions статистика
    if (report.sf && report.sf.length > 0) {
      console.log(`\n🔍 SELF FUNCTIONS (изолированные функции): ${report.sf.length}`);
      if (options.verbose) {
        const sampleSize = Math.min(report.sf.length, 5);
        console.log('   Примеры:');
        for (let i = 0; i < sampleSize; i++) {
          const sf = report.sf[i];
          if (sf) {
            const fileName = report.fl?.[sf[2]] || sf[2];
            console.log(`   • ${sf[1]} (${fileName}:${sf[3]})`);
          }
        }
        if (report.sf.length > 5) {
          console.log(`   ... и ещё ${report.sf.length - 5} self functions`);
        }
      }
    }

    // Предупреждения о неразрешенных импортах
    if (report.unresolved && report.unresolved.length > 0) {
      console.log(`\n⚠️ НЕРАЗРЕШЕННЫХ ИМПОРТОВ: ${report.unresolved.length}`);
      if (options.verbose) {
        for (const unres of report.unresolved.slice(0, 5)) {
          console.log(`   • Модуль ${unres.module}: ${unres.target} (строка ${unres.line})`);
        }
        if (report.unresolved.length > 5) {
          console.log(`   ... и ещё ${report.unresolved.length - 5}`);
        }
      }
    }

    console.log('\n' + '='.repeat(70));

    console.log('\n💡 КАК ИСПОЛЬЗОВАТЬ ОТЧЕТ:');
    console.log('   • Откройте файл в любом текстовом редакторе');
    console.log('   • Используйте индексы mi/fl для навигации');
    console.log('   • fns - список всех функций');
    console.log('   • sf - список self функций (изолированные) ✅ НОВОЕ');
    console.log('   • cn - список всех констант');
    console.log('   • gr.c - граф вызовов');
    console.log('   • gr.i - граф импортов');
    console.log('   • gr.e - граф экспортов');
    console.log('   • st - общая статистика');
    console.log('   • tsf - общее количество self функций');
    console.log('   • Легенда (legend) для расшифровки всех кодов и ключей');

    if (options.ultra) {
      console.log('   🚀 Ультра-компактный режим: идеально для отправки в AI');
      console.log('   📊 Экономия места: ~70% по сравнению со стандартным форматом');
    }

    if (report.sf && report.sf.length > 0) {
      console.log('   🔍 Self functions: функции без вызовов — отличные кандидаты для выделения');
    }

    console.log('');
  }

  private saveVerboseInfo(report: any, outputDir: string, entitiesMap: Record<string, any>): void {
    // Сохраняем полную статистику по модулям
    const statsPath = path.join(outputDir, 'compact-stats.json');
    const stats = {
      modules: report.mi ? Object.keys(report.mi).length : 0,
      files: report.fl ? Object.keys(report.fl).length : 0,
      functions: report.fns ? report.fns.length : 0,
      selfFunctions: report.sf ? report.sf.length : 0, // ✅
      constants: report.cn ? report.cn.length : 0,
      calls: report.gr?.c ? report.gr.c.length : 0,
      imports: report.gr?.i ? report.gr.i.length : 0,
      exports: report.gr?.e ? report.gr.e.length : 0,
      modulesData: report.mi || {},
      filesData: report.fl || {},
    };
    fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2));
    console.log(`📄 Детальная статистика сохранена: ${statsPath}`);

    // Сохраняем информацию о сущностях в читаемом формате
    const entitiesPath = path.join(outputDir, 'compact-entities-readable.json');
    const readableEntities: Record<string, any> = {};
    for (const [filePath, entities] of Object.entries(entitiesMap)) {
      readableEntities[filePath] = {
        functionsCount: entities.functions?.length || 0,
        classesCount: entities.classes?.length || 0,
        constantsCount: entities.constants?.length || 0,
        importsCount: entities.imports?.length || 0,
        exportsCount: entities.exports?.length || 0,
        interfacesCount: entities.interfaces?.length || 0,
        typesCount: entities.types?.length || 0,
        variablesCount: entities.variables?.length || 0,
        selfFunctionsCount: (entities.functions || []).filter(
          (f: any) => !(f.calls && f.calls.length > 0) && !(f.calledBy && f.calledBy.length > 0)
        ).length, // ✅
      };
    }
    fs.writeFileSync(entitiesPath, JSON.stringify(readableEntities, null, 2));
    console.log(`📄 Информация о сущностях сохранена: ${entitiesPath}`);

    // Сохраняем граф вызовов в DOT формате для визуализации
    if (report.gr?.c && report.gr.c.length > 0) {
      const dotPath = path.join(outputDir, 'compact-callgraph.dot');
      const dot = this.generateDOT(report);
      fs.writeFileSync(dotPath, dot);
      console.log(`📄 DOT граф сохранен: ${dotPath}`);
    }

    // Сохраняем self functions в отдельный файл
    if (report.sf && report.sf.length > 0) {
      const sfPath = path.join(outputDir, 'compact-self-functions.json');
      const sfData = report.sf.map((sf: any[]) => ({
        id: sf[0],
        name: sf[1],
        file: report.fl?.[sf[2]] || sf[2],
        line: sf[3],
      }));
      fs.writeFileSync(sfPath, JSON.stringify(sfData, null, 2));
      console.log(`📄 Self functions сохранены: ${sfPath}`);
    }
  }

  private generateDOT(report: any): string {
    let dot = 'digraph CallGraph {\n';
    dot += '  rankdir=LR;\n';
    dot += '  node [shape=box, style="filled,rounded", fillcolor="#f3f4f6"];\n';
    dot += '  edge [color="#9ca3af", arrowhead=vee];\n\n';

    // Получаем имена функций из fns
    const functionNames: Record<string, string> = {};
    if (report.fns) {
      for (const func of report.fns) {
        if (func && func.length >= 2) {
          functionNames[func[0]] = func[1];
        }
      }
    }

    // Узлы - все функции из fns
    const nodes = new Set<string>();
    if (report.fns) {
      for (const func of report.fns) {
        if (func && func.length >= 2) {
          nodes.add(func[0]);
        }
      }
    }

    // Определяем точки входа (функции, которые никто не вызывает)
    const called = new Set<string>();
    if (report.gr?.c) {
      for (const call of report.gr.c) {
        if (call && call.length >= 2) {
          called.add(call[1]);
        }
      }
    }

    // Определяем self functions (изолированные)
    const selfIds = new Set<string>();
    if (report.sf) {
      for (const sf of report.sf) {
        if (sf && sf.length >= 1) {
          selfIds.add(sf[0]);
        }
      }
    }

    for (const nodeId of nodes) {
      const name = functionNames[nodeId] || nodeId;
      const isEntry = !called.has(nodeId);
      const isSelf = selfIds.has(nodeId);
      let color = '#f3f4f6';
      let fontColor = '#1f2937';
      let label = name;
      let shape = 'box';

      if (isEntry) {
        color = '#4f46e5';
        fontColor = '#ffffff';
        label = `⭐ ${name}`;
      } else if (isSelf) {
        color = '#22d3ee';
        fontColor = '#0f172a';
        shape = 'ellipse';
        label = `🔹 ${name}`;
      }

      dot += `  "${nodeId}" [fillcolor="${color}", fontcolor="${fontColor}", label="${label}", shape="${shape}"];\n`;
    }

    dot += '\n';

    // Ребра - вызовы из gr.c
    if (report.gr?.c) {
      for (const call of report.gr.c) {
        if (call && call.length >= 3) {
          const from = call[0];
          const to = call[1];
          const line = call[2] || 0;
          const type = call[3] || 'd';
          const color = type === 'a' ? '#ef4444' : type === 'm' ? '#f59e0b' : '#3b82f6';
          const style = type === 'a' ? 'dashed' : 'solid';
          const isSelfFrom = selfIds.has(from);
          const isSelfTo = selfIds.has(to);
          const penwidth = isSelfFrom || isSelfTo ? '0.5' : '1';
          dot += `  "${from}" -> "${to}" [color="${color}", style="${style}", penwidth=${penwidth}, label="${type}${line ? ` [${line}]` : ''}"];\n`;
        }
      }
    }

    dot += '}\n';
    return dot;
  }

  getCommand(): Command {
    return this.program;
  }
}

export default CompactCommand;
