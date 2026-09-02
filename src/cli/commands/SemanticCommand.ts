// packages/ast-analyzer/src/cli/commands/SemanticCommand.ts
// НОВЫЙ ФАЙЛ - Полный текст

import { Command } from 'commander';
import path from 'path';
import fs from 'fs';
import { glob } from 'glob';

/**
 * Команда для семантического анализа кода
 *
 * Выполняет:
 * - CFG (Control Flow Graph) анализ
 * - Call Graph анализ
 * - Data Flow анализ
 * - TypeScript анализ
 * - Формальную верификацию через Z3 (опционально)
 * - Генерацию отчетов в разных форматах
 */
export class SemanticCommand {
  private program: Command;

  constructor(program: Command) {
    this.program = program;
    this.register();
  }

  private register(): void {
    this.program
      .command('semantic <paths...>')
      .description(
        '🔬 Полный семантический анализ кода: CFG, Call Graph, Types, Data Flow, Formal Verification'
      )
      .option('-r, --recursive', 'Рекурсивный поиск файлов в директориях', true)
      .option('--formal', 'Включить формальную верификацию через Z3', false)
      .option('--max-depth <n>', 'Максимальная глубина анализа Call Graph', '5')
      .option('--critical <functions>', 'Критические функции для верификации (через запятую)')
      .option('-o, --output <dir>', 'Директория для сохранения отчётов', './semantic-reports')
      .option('--format <format>', 'Формат отчёта (json, html, markdown)', 'html')
      .option('--no-cfg', 'Отключить CFG анализ', false)
      .option('--no-callgraph', 'Отключить Call Graph анализ', false)
      .option('--no-dataflow', 'Отключить Data Flow анализ', false)
      .option('--no-typescript', 'Отключить TypeScript анализ', false)
      .option('--no-jsx', 'Отключить JSX/TSX анализ', false)
      .option('--no-vue', 'Отключить Vue анализ', false)
      .option('-v, --verbose', 'Подробный вывод', false)
      .action(async (paths: string[], options: any) => {
        try {
          await this.execute(paths, options);
        } catch (error) {
          console.error('❌ Semantic analysis failed:', error);
          process.exit(1);
        }
      });
  }

  /**
   * Выполняет семантический анализ
   */
  private async execute(paths: string[], options: any): Promise<void> {
    console.log('\n' + '='.repeat(70));
    console.log('🔬 ПОЛНЫЙ СЕМАНТИЧЕСКИЙ АНАЛИЗ');
    console.log('='.repeat(70));
    console.log(`📁 Пути: ${paths.join(', ')}`);
    console.log(`📏 Глубина: ${options.maxDepth}`);
    console.log(`🔬 Формальная верификация: ${options.formal ? 'ВКЛЮЧЕНА' : 'ВЫКЛЮЧЕНА'}`);
    console.log(`📄 Формат отчёта: ${options.format}`);
    console.log(`📁 Выходная директория: ${options.output}`);
    console.log('');

    // Собираем файлы
    const files = await this.collectFiles(paths, options.recursive);

    if (files.length === 0) {
      console.error('❌ Не найдено файлов для анализа');
      process.exit(1);
    }

    console.log(`📊 Найдено файлов: ${files.length}`);
    console.log('');

    // Вывод статуса анализаторов
    console.log('📋 АКТИВНЫЕ АНАЛИЗАТОРЫ:');
    console.log(`   • CFG Analysis: ${options.cfg !== false ? '✅' : '❌'}`);
    console.log(`   • Call Graph: ${options.callgraph !== false ? '✅' : '❌'}`);
    console.log(`   • Data Flow: ${options.dataflow !== false ? '✅' : '❌'}`);
    console.log(`   • TypeScript: ${options.typescript !== false ? '✅' : '❌'}`);
    console.log(`   • JSX/TSX: ${options.jsx !== false ? '✅' : '❌'}`);
    console.log(`   • Vue: ${options.vue !== false ? '✅' : '❌'}`);
    console.log(`   • Formal Verification: ${options.formal ? '✅' : '❌'}`);
    console.log('');

    // Парсим критические функции
    let criticalFunctions: string[] = [];
    if (options.critical) {
      criticalFunctions = options.critical.split(',').map((f: string) => f.trim());
      console.log(`🎯 Критические функции: ${criticalFunctions.join(', ')}`);
      console.log('');
    }

    // Создаем директорию для отчетов
    const outputDir = path.resolve(options.output);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    try {
      // Импортируем SemanticPipeline
      const { SemanticPipeline } = await import('../../ci-cd/SemanticPipeline.js');

      // Создаем и запускаем пайплайн
      const pipeline = new SemanticPipeline();
      const result = await pipeline.run(files, {
        formalVerification: options.formal,
        maxDepth: parseInt(options.maxDepth),
        criticalFunctions: criticalFunctions,
        generateReport: true,
        reportFormat: options.format,
        outputDir: options.output,
      });

      // Выводим результаты
      this.printResults(result, options);

      // Сохраняем JSON отчет для машинной обработки
      const jsonPath = path.join(outputDir, `semantic-analysis-${Date.now()}.json`);
      const jsonData = {
        success: result.success,
        metrics: result.metrics,
        issues: result.issues.map((i: any) => ({
          type: i.type,
          severity: i.severity,
          file: path.basename(i.file),
          line: i.line,
          message: i.message,
          suggestion: i.suggestion,
        })),
        verificationResults: result.verificationResults,
        timestamp: result.timestamp,
        duration: result.duration,
      };
      fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2));
      console.log(`\n📄 JSON отчёт сохранён: ${jsonPath}`);

      // Дополнительная статистика по типам анализа
      if (options.verbose) {
        console.log('\n📊 ДЕТАЛЬНАЯ СТАТИСТИКА:');
        console.log(`   • Всего функций: ${result.metrics.totalFunctions}`);
        console.log(`   • Цикломатическая сложность: ${result.metrics.cyclomaticComplexity}`);
        console.log(`   • Неиспользуемых функций: ${result.metrics.unusedFunctions}`);
        console.log(`   • Неиспользуемых переменных: ${result.metrics.unusedVariables}`);
        console.log(`   • Ошибок типов: ${result.metrics.typeErrors}`);
        console.log(`   • Циклических зависимостей: ${result.metrics.cyclicDependencies}`);
        console.log(`   • Недостижимых блоков: ${result.metrics.unreachableBlocks}`);
        console.log(`   • Верифицировано функций: ${result.metrics.verifiedFunctions}`);
      }

      // Если есть JSX анализ, показываем статистику
      if (result.jsxAnalysis && options.verbose) {
        console.log('\n⚛️ JSX/TSX СТАТИСТИКА:');
        console.log(`   • JSX элементов: ${result.jsxAnalysis.elements.length}`);
        console.log(`   • Компонентов: ${result.jsxAnalysis.componentProps.size}`);
        console.log(`   • Ошибок пропсов: ${result.jsxAnalysis.propTypeErrors.length}`);
      }

      // Exit code
      if (!result.success) {
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Ошибка при выполнении семантического анализа:', error);
      if (options.verbose && error instanceof Error && error.stack) {
        console.error('\n📚 Стек ошибки:');
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
   * Выводит результаты анализа
   */
  private printResults(result: any, options: any): void {
    console.log('\n' + '='.repeat(70));
    console.log('📊 ИТОГИ СЕМАНТИЧЕСКОГО АНАЛИЗА');
    console.log('='.repeat(70));

    const statusIcon = result.success ? '✅' : '❌';
    const statusText = result.success ? 'УСПЕШНО' : 'ОБНАРУЖЕНЫ ПРОБЛЕМЫ';
    console.log(`${statusIcon} Статус: ${statusText}`);
    console.log(`⏱️ Время: ${(result.duration / 1000).toFixed(2)} сек`);

    console.log('\n📈 МЕТРИКИ:');
    console.log(`   • Файлов проанализировано: ${result.metrics.totalFiles}`);
    console.log(`   • Всего функций: ${result.metrics.totalFunctions}`);
    console.log(`   • Неиспользуемых функций: ${result.metrics.unusedFunctions}`);
    console.log(`   • Неиспользуемых переменных: ${result.metrics.unusedVariables}`);
    console.log(`   • Цикломатическая сложность: ${result.metrics.cyclomaticComplexity}`);
    console.log(`   • Ошибок типов: ${result.metrics.typeErrors}`);
    console.log(`   • Циклических зависимостей: ${result.metrics.cyclicDependencies}`);
    console.log(`   • Недостижимых блоков: ${result.metrics.unreachableBlocks}`);
    console.log(`   • Верифицировано функций: ${result.metrics.verifiedFunctions}`);

    const errors = result.issues.filter((i: any) => i.severity === 'error');
    const warnings = result.issues.filter((i: any) => i.severity === 'warning');
    const info = result.issues.filter((i: any) => i.severity === 'info');

    console.log('\n⚠️ ПРОБЛЕМЫ:');
    console.log(`   • Ошибок: ${errors.length}`);
    console.log(`   • Предупреждений: ${warnings.length}`);
    console.log(`   • Замечаний: ${info.length}`);

    // Показываем ошибки
    if (errors.length > 0) {
      console.log('\n🔴 ОШИБКИ (первые 10):');
      for (const error of errors.slice(0, 10)) {
        console.log(`   • ${path.basename(error.file)}:${error.line} - ${error.message}`);
        if (error.suggestion && options.verbose) {
          console.log(`     💡 ${error.suggestion}`);
        }
      }
      if (errors.length > 10) {
        console.log(`   ... и ещё ${errors.length - 10} ошибок`);
      }
    }

    // Показываем предупреждения
    if (warnings.length > 0 && result.success) {
      console.log('\n🟡 ПРЕДУПРЕЖДЕНИЯ (первые 5):');
      for (const warning of warnings.slice(0, 5)) {
        console.log(`   • ${path.basename(warning.file)}:${warning.line} - ${warning.message}`);
        if (warning.suggestion && options.verbose) {
          console.log(`     💡 ${warning.suggestion}`);
        }
      }
      if (warnings.length > 5) {
        console.log(`   ... и ещё ${warnings.length - 5} предупреждений`);
      }
    }

    // Результаты формальной верификации
    if (result.verificationResults && result.verificationResults.length > 0) {
      const verified = result.verificationResults.filter((r: any) => r.isValid);
      const failed = result.verificationResults.filter((r: any) => !r.isValid);

      console.log('\n🔬 ФОРМАЛЬНАЯ ВЕРИФИКАЦИЯ:');
      console.log(`   • Верифицировано: ${verified.length}`);
      console.log(`   • Не верифицировано: ${failed.length}`);

      if (failed.length > 0) {
        console.log('\n   НЕ ВЕРИФИЦИРОВАНЫ:');
        for (const fail of failed.slice(0, 5)) {
          console.log(`   • ${fail.functionName || 'unknown'}`);
          if (fail.counterexample && options.verbose) {
            console.log(
              `     Контрпример: ${JSON.stringify(Object.fromEntries(fail.counterexample))}`
            );
          }
          if (fail.error) {
            console.log(`     Ошибка: ${fail.error}`);
          }
        }
        if (failed.length > 5) {
          console.log(`   ... и ещё ${failed.length - 5} функций`);
        }
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log(`📄 Отчёты сохранены в: ${options.output}`);
    console.log('='.repeat(70) + '\n');
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

export default SemanticCommand;
