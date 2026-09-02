// packages/ast-analyzer/src/cli/commands/CompactCommand.ts
// НОВЫЙ ФАЙЛ - Полный текст

import type { Command } from 'commander';
import path from 'path';
import fs from 'fs';
import { glob } from 'glob';

/**
 * Команда для генерации компактного отчета сущностей
 *
 * Особенности:
 * - Минимизированные ключи (экономия до 45% размера)
 * - Короткие ID (m1, f1, fn1, ...)
 * - Битовые флаги вместо булевых полей
 * - Словари для параметров и типов
 * - Ультра-компактный режим (максимальное сжатие)
 * - Поддержка шаблонов для повторяющихся структур
 * - Полная легенда для всех кодов и ключей
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

  /**
   * Выполняет генерацию компактного отчета
   */
  private async execute(paths: string[], options: any): Promise<void> {
    console.log('\\n' + '='.repeat(70));
    console.log('📋 ГЕНЕРАЦИЯ КОМПАКТНОГО ОТЧЕТА СУЩНОСТЕЙ');
    console.log('='.repeat(70));
    console.log(`📁 Пути: ${paths.join(', ')}`);
    console.log(`📄 Выходной файл: ${options.output}`);
    console.log(`🚀 Ультра-компактный режим: ${options.ultra ? 'ВКЛЮЧЕН' : 'ВЫКЛЮЧЕН'}`);
    console.log(`📋 Пресет: ${options.preset}`);
    console.log(`📏 Глубина: ${options.maxDepth}`);
    console.log(`📝 Включить тела функций: ${options.includeBody ? 'ДА' : 'НЕТ'}`);
    console.log(`🔒 Информация о безопасности: ${options.includeSecurity ? 'ДА' : 'НЕТ'}`);
    console.log('');

    // Применяем пресет
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
      // Импортируем необходимые модули - используем правильный путь к compact-reporter
      const { parseFile } = await import('../../core/ast-parser.js');
      const { extractEntities } = await import('../../core/entity-extractor.js');
      const { generateCompactReport, generateUltraCompactReport } =
        await import('../../reporters/compact-reporter.js');

      // Собираем сущности из всех файлов
      const entitiesMap: Record<string, any> = {};
      let totalFunctions = 0;
      let totalClasses = 0;
      let totalConstants = 0;

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
      console.log('');

      // Генерируем отчет
      let report;
      const startTime = Date.now();

      const reportOptions = {
        useBitFlags: options.bitFlags !== false,
        useDictionaries: options.dictionaries !== false,
        readableKeys: !options.minifyKeys,
        useTemplates: options.templates !== false,
        maxDepth: parseInt(options.maxDepth),
        includeBody: options.includeBody,
        includeSecurity: options.includeSecurity,
      };

      if (options.ultra) {
        console.log('🚀 Генерация ультра-компактного отчета...');
        report = generateUltraCompactReport(entitiesMap, outputPath, reportOptions);
      } else {
        console.log('📋 Генерация компактного отчета...');
        report = generateCompactReport(entitiesMap, outputPath, reportOptions);
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      // Выводим результаты
      this.printResults(report, outputPath, duration, options);

      // Сохраняем дополнительную информацию
      if (options.verbose) {
        this.saveVerboseInfo(report, outputDir, entitiesMap);
      }
    } catch (error) {
      console.error('❌ Ошибка при генерации отчета:', error);
      if (options.verbose && error instanceof Error && error.stack) {
        console.error('\\n📚 Стек ошибки:');
        console.error(error.stack);
      }
      process.exit(1);
    }
  }

  /**
   * Собирает файлы для анализа
   */
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

  /**
   * Выводит результаты
   */
  private printResults(report: any, outputPath: string, duration: string, options: any): void {
    const sizeKB = (JSON.stringify(report).length / 1024).toFixed(2);

    console.log('\\n' + '='.repeat(70));
    console.log('✅ ОТЧЕТ УСПЕШНО СОЗДАН!');
    console.log('='.repeat(70));
    console.log(`📄 Файл: ${outputPath}`);
    console.log(`📊 Размер: ${sizeKB} KB`);
    console.log(`⏱️  Время: ${duration} сек`);

    console.log('\\n📊 СТАТИСТИКА ОТЧЕТА:');
    if (report.stats) {
      console.log(`   • Модулей: ${report.stats.totalModules || 0}`);
      console.log(`   • Файлов: ${report.stats.totalFiles || 0}`);
      console.log(`   • Функций: ${report.stats.totalFunctions || 0}`);
      console.log(`   • Вызовов: ${report.stats.totalCalls || 0}`);
      console.log(`   • Импортов: ${report.stats.totalImports || 0}`);
      console.log(`   • Экспортов: ${report.stats.totalExports || 0}`);
      console.log(`   • Неразрешенных: ${report.stats.totalUnresolved || 0}`);
    }

    // Информация о сжатии
    console.log('\\n📦 ИНФОРМАЦИЯ О СЖАТИИ:');
    console.log(`   • Режим: ${options.ultra ? 'УЛЬТРА-КОМПАКТНЫЙ' : 'КОМПАКТНЫЙ'}`);
    console.log(`   • Битовые флаги: ${options.bitFlags !== false ? 'ВКЛЮЧЕНЫ' : 'ВЫКЛЮЧЕНЫ'}`);
    console.log(`   • Словари: ${options.dictionaries !== false ? 'ВКЛЮЧЕНЫ' : 'ВЫКЛЮЧЕНЫ'}`);
    console.log(`   • Минификация ключей: ${options.minifyKeys ? 'ВКЛЮЧЕНА' : 'ВЫКЛЮЧЕНА'}`);
    console.log(`   • Шаблоны: ${options.templates !== false ? 'ВКЛЮЧЕНЫ' : 'ВЫКЛЮЧЕНЫ'}`);
    console.log(`   • Легенда: ${options.legend !== false ? 'ВКЛЮЧЕНА' : 'ВЫКЛЮЧЕНА'}`);

    if (report.legend && options.legend !== false) {
      console.log('\\n📖 ЛЕГЕНДА (кратко):');
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

    // Предупреждения
    if (report.unresolved && report.unresolved.length > 0) {
      console.log(`\\n⚠️ НЕРАЗРЕШЕННЫХ ИМПОРТОВ: ${report.unresolved.length}`);
      if (options.verbose) {
        for (const unres of report.unresolved.slice(0, 5)) {
          console.log(`   • Модуль ${unres.module}: ${unres.target} (строка ${unres.line})`);
        }
        if (report.unresolved.length > 5) {
          console.log(`   ... и ещё ${report.unresolved.length - 5}`);
        }
      }
    }

    console.log('\\n' + '='.repeat(70));

    // Подсказки по использованию
    console.log('\\n💡 КАК ИСПОЛЬЗОВАТЬ ОТЧЕТ:');
    console.log('   • Откройте файл в любом текстовом редакторе');
    console.log('   • Используйте индекс functionIndex для поиска функций по ID');
    console.log('   • moduleIndex и fileIndex для навигации по модулям и файлам');
    console.log('   • callGraph для анализа всех связей между функциями');
    console.log('   • functionCalls для быстрого доступа к вызовам каждой функции');
    console.log('   • nodeDetails для детальной информации о каждой сущности');
    console.log('   • Легенда (legend) для расшифровки всех кодов и ключей');

    if (options.ultra) {
      console.log('   🚀 Ультра-компактный режим: идеально для отправки в AI');
      console.log('   📊 Экономия места: ~70% по сравнению со стандартным форматом');
    }

    console.log('');
  }

  /**
   * Сохраняет дополнительную информацию для verbose режима
   */
  private saveVerboseInfo(report: any, outputDir: string, entitiesMap: Record<string, any>): void {
    // Сохраняем полную статистику по модулям
    const statsPath = path.join(outputDir, 'compact-stats.json');
    const stats = {
      modules: report.modules ? Object.keys(report.modules).length : 0,
      files: report.files ? Object.keys(report.files).length : 0,
      functions: report.functionIndex ? Object.keys(report.functionIndex).length : 0,
      calls: report.functionCalls
        ? (Object.values(report.functionCalls) as any[][]).reduce(
            (sum: number, calls: any[]) => sum + calls.length,
            0
          )
        : 0,
      modulesData: report.modules || {},
      filesData: report.files || {},
      functionIndex: report.functionIndex || {},
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
      };
    }
    fs.writeFileSync(entitiesPath, JSON.stringify(readableEntities, null, 2));
    console.log(`📄 Информация о сущностях сохранена: ${entitiesPath}`);

    // Сохраняем граф вызовов в DOT формате для визуализации
    if (report.callGraph && report.callGraph.nodes && report.callGraph.edges) {
      const dotPath = path.join(outputDir, 'compact-callgraph.dot');
      const dot = this.generateDOT(report.callGraph);
      fs.writeFileSync(dotPath, dot);
      console.log(`📄 DOT граф сохранен: ${dotPath}`);
    }
  }

  /**
   * Генерирует DOT граф для визуализации
   */
  private generateDOT(callGraph: any): string {
    let dot = 'digraph CallGraph {\\n';
    dot += '  rankdir=LR;\\n';
    dot += '  node [shape=box, style="filled,rounded", fillcolor="#f3f4f6"];\\n';
    dot += '  edge [color="#9ca3af", arrowhead=vee];\\n\\n';

    // Узлы
    const nodes = callGraph.nodes || [];
    for (let i = 0; i < nodes.length; i++) {
      const name = nodes[i] || `node_${i}`;
      const isEntry = callGraph.entryPoints && callGraph.entryPoints.includes(i);
      const color = isEntry ? '#4f46e5' : '#f3f4f6';
      const fontColor = isEntry ? '#ffffff' : '#1f2937';
      const label = isEntry ? `⭐ ${name}` : name;
      dot += `  "n${i}" [fillcolor="${color}", fontcolor="${fontColor}", label="${label}"];\\n`;
    }

    dot += '\\n';

    // Ребра
    const edges = callGraph.edges || [];
    for (const edge of edges) {
      const [from, to, line, typeIdx] = edge;
      const types = callGraph.types || ['call'];
      const type = types[typeIdx] || 'call';
      const color = type === 'call' ? '#3b82f6' : type === 'import' ? '#22c55e' : '#f59e0b';
      const style = type === 'import' ? 'dashed' : 'solid';
      dot += `  "n${from}" -> "n${to}" [color="${color}", style="${style}", label="${type}${line ? ` [${line}]` : ''}"];\\n`;
    }

    // Циклы
    const cycles = callGraph.cycles || [];
    if (cycles.length > 0) {
      dot += '\\n  // Циклические зависимости:\\n';
      for (const cycle of cycles) {
        dot += `  // ${cycle.join(' → ')}\\n`;
      }
    }

    dot += '}\\n';
    return dot;
  }

  /**
   * Возвращает команду для регистрации
   */
  getCommand(): Command {
    return this.program;
  }
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default CompactCommand;
