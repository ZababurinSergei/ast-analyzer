// packages/ast-analyzer/src/cli/commands/SplitModuleCommand.ts
// НОВЫЙ ФАЙЛ - Полный текст

import type { Command } from 'commander';
import path from 'path';
import fs from 'fs';

/**
 * Команда split-module - разбиение файла на модули с генерацией AI промпта
 *
 * Эта команда анализирует файл, выделяет кластеры функций и генерирует
 * подробный промпт для AI, который поможет разбить монолитный файл
 * на логически связанные модули.
 */
export class SplitModuleCommand {
  private program: Command;

  constructor(program: Command) {
    this.program = program;
    this.register();
  }

  private register(): void {
    this.program
      .command('split-module <file>')
      .description('🔪 Split file into modules - generate AI prompt with analysis')
      .alias('split')
      .option('-o, --output <file>', 'Output file for prompt', 'ai-split-module-prompt.md')
      .option('-t, --target-size <n>', 'Target cluster size (functions per module)', '3')
      .option('-m, --max-size <n>', 'Maximum cluster size', '10')
      .option('-d, --max-depth <n>', 'Maximum depth for call graph analysis', '5')
      .option('-x, --exclude <list>', 'Exclude patterns (comma-separated)')
      .option('--prefix <str>', 'Prefix for output files')
      .option('--no-full-code', 'Exclude full code from prompt')
      .option('--no-minified', 'Exclude minified version')
      .option('--no-graph', 'Exclude call graph')
      .option('--no-stats', 'Exclude statistics')
      .option('--no-suggestions', 'Exclude suggestions')
      .option('--no-vue', 'Skip Vue analysis')
      .option('--vue-only', 'Only Vue analysis (for .vue files)')
      .option('-v, --verbose', 'Verbose output')
      .option('--format <format>', 'Output format: markdown, json', 'markdown')
      .action(async (file, options) => {
        try {
          await this.execute(file, options);
        } catch (error) {
          console.error('❌ Error:', error instanceof Error ? error.message : String(error));
          process.exit(1);
        }
      });
  }

  private async execute(file: string, options: any): Promise<void> {
    const absolutePath = path.resolve(file);

    console.log('\n' + '='.repeat(70));
    console.log('🔪 SPLIT MODULE - АНАЛИЗ И РАЗБИЕНИЕ ФАЙЛА');
    console.log('='.repeat(70));
    console.log(`📄 Файл: ${absolutePath}`);
    console.log(`📁 Выходной файл: ${options.output}`);
    console.log(`🎯 Целевой размер кластера: ${options.targetSize}`);
    console.log(`📏 Максимальный размер кластера: ${options.maxSize}`);
    console.log(`🔍 Глубина анализа: ${options.maxDepth}`);
    console.log(`📋 Формат: ${options.format}`);
    console.log(`⚛️ Vue анализ: ${options.vue !== false ? 'ВКЛЮЧЕН' : 'ВЫКЛЮЧЕН'}`);
    console.log('='.repeat(70) + '\n');

    if (!fs.existsSync(absolutePath)) {
      console.error(`❌ Файл не найден: ${absolutePath}`);
      process.exit(1);
    }

    const isVue = absolutePath.endsWith('.vue');
    if (isVue) {
      console.log('📦 Обнаружен Vue компонент');
    }

    // Проверяем расширение
    const ext = path.extname(absolutePath);
    const supportedExtensions = ['.ts', '.tsx', '.js', '.jsx', '.vue', '.mjs', '.cjs'];
    if (!supportedExtensions.includes(ext)) {
      console.warn(`⚠️ Неподдерживаемое расширение: ${ext}`);
      console.warn(`   Поддерживаемые: ${supportedExtensions.join(', ')}`);
      console.warn('   Продолжаем анализ...\n');
    }

    // Парсим паттерны исключения
    const excludePatterns = options.exclude
      ? options.exclude.split(',').map((p: string) => p.trim())
      : ['node_modules', 'dist', 'build', '.git'];

    // Параметры для split-module
    const splitOptions = {
      outputFile: options.output,
      targetClusterSize: parseInt(options.targetSize),
      maxClusterSize: parseInt(options.maxSize),
      maxDepth: parseInt(options.maxDepth),
      excludePatterns,
      prefix: options.prefix || '',
      includeFullCode: options.fullCode !== false,
      includeMinified: options.minified !== false,
      includeGraph: options.graph !== false,
      includeStats: options.stats !== false,
      includeSuggestions: options.suggestions !== false,
      includeVueAnalysis: options.vue !== false && isVue,
      verbose: options.verbose || false,
      vueOnly: options.vueOnly || false,
      format: options.format || 'markdown',
    };

    console.log('📊 Параметры анализа:');
    console.log(`   • Целевой размер: ${splitOptions.targetClusterSize}`);
    console.log(`   • Максимальный размер: ${splitOptions.maxClusterSize}`);
    console.log(`   • Глубина: ${splitOptions.maxDepth}`);
    console.log(`   • Исключения: ${splitOptions.excludePatterns.join(', ')}`);
    if (splitOptions.prefix) {
      console.log(`   • Префикс: ${splitOptions.prefix}`);
    }
    console.log('');

    try {
      // Загружаем модуль split-module
      const { buildSplitModulePrompt } = await import('../../modes/split-module.js');

      // Выполняем анализ
      const result = await buildSplitModulePrompt(absolutePath, splitOptions);

      if (!result) {
        console.error('❌ Не удалось проанализировать файл');
        process.exit(1);
      }

      // Извлекаем кластеры из результата с проверкой на существование
      const clusters = (result as any).clusters || [];

      // Выводим результаты
      console.log('\n' + '='.repeat(70));
      console.log('📊 РЕЗУЛЬТАТЫ АНАЛИЗА');
      console.log('='.repeat(70));

      // Статистика файла
      if (result.analysis && result.analysis.stats) {
        const stats = result.analysis.stats;
        console.log('\n📈 СТАТИСТИКА ФАЙЛА:');
        console.log(`   • Всего строк: ${stats.totalLines}`);
        console.log(`   • Функций: ${stats.totalFunctions}`);
        console.log(`   • Классов: ${stats.totalClasses}`);
        console.log(`   • Констант: ${stats.totalConstants}`);
        console.log(`   • Экспортов: ${stats.totalExports}`);
        console.log(`   • Импортов: ${stats.totalImports}`);
        console.log(
          `   • Интерфейсов/Типов: ${(stats.totalInterfaces || 0) + (stats.totalTypes || 0)}`
        );
      }

      // Кластеры
      if (clusters.length > 0) {
        console.log(`\n🔗 ВЫЯВЛЕННЫЕ КЛАСТЕРЫ (${clusters.length}):`);
        for (let i = 0; i < clusters.length; i++) {
          const cluster = clusters[i];
          if (!cluster) continue;
          console.log(`   ${i + 1}. ${cluster.name}:`);
          console.log(`      • Функций: ${cluster.functions.length}`);
          console.log(`      • Тип: ${cluster.type}`);
          console.log(`      • Связность: ${cluster.cohesionScore.toFixed(1)}%`);
          console.log(
            `      • Функции: ${cluster.functions.slice(0, 5).join(', ')}${cluster.functions.length > 5 ? '...' : ''}`
          );
          if (cluster.recommendation) {
            console.log(`      • Рекомендация: ${cluster.recommendation}`);
          }
        }
      } else {
        console.log('\nℹ️ Кластеры не обнаружены');
      }

      // Vue анализ
      if (result.vueAnalysis) {
        const vue = result.vueAnalysis;
        console.log('\n⚛️ VUE КОМПОНЕНТ:');
        console.log(`   • Имя: ${vue.componentName || path.basename(file, '.vue')}`);
        console.log(`   • Props: ${vue.props.names.length}`);
        console.log(`   • Events: ${vue.emits.names.length}`);
        console.log(`   • Slots: ${vue.slots.length}`);
        console.log(`   • Composables: ${vue.composables.length}`);
        console.log(`   • Тип скрипта: ${vue.script.isSetup ? 'setup' : 'options'}`);
        console.log(`   • TypeScript: ${vue.script.isTS ? '✅' : '❌'}`);
        console.log(`   • Строк скрипта: ${vue.stats.scriptLines}`);
        console.log(`   • Строк шаблона: ${vue.stats.templateLines}`);
        if (vue.template && vue.template.complexity) {
          console.log(`   • Сложность шаблона: ${vue.template.complexity}`);
        }
      }

      // Выходные файлы
      console.log('\n📁 ВЫХОДНЫЕ ФАЙЛЫ:');
      const outputFiles = result.outputFiles || {};
      for (const [key, filePath] of Object.entries(outputFiles)) {
        if (filePath) {
          const fullPath = path.resolve(filePath);
          const size = fs.existsSync(fullPath) ? fs.statSync(fullPath).size : 0;
          console.log(`   • ${key}: ${path.basename(filePath)} (${(size / 1024).toFixed(2)} KB)`);
        }
      }

      // Размер промпта
      if (result.markdown) {
        const size = result.markdown.length;
        console.log(`\n📊 РАЗМЕР ПРОМПТА: ${(size / 1024).toFixed(2)} KB (${size} символов)`);
        console.log(`   💡 Ожидаемое количество токенов: ~${Math.round(size / 4)}`);
      }

      // Рекомендации
      console.log('\n💡 РЕКОМЕНДАЦИИ:');
      if (clusters.length > 0) {
        const exportedClusters = clusters.filter((c: any) => c.isExported);
        const helperClusters = clusters.filter((c: any) => !c.isExported);

        if (exportedClusters.length > 0) {
          console.log(
            `   • ${exportedClusters.length} экспортируемых кластеров — хорошие кандидаты для выделения`
          );
        }
        if (helperClusters.length > 0) {
          console.log(
            `   • ${helperClusters.length} вспомогательных кластеров — могут быть выделены в утилиты`
          );
        }

        const lowCohesion = clusters.filter((c: any) => c.cohesionScore < 40);
        if (lowCohesion.length > 0) {
          console.log(
            `   • ${lowCohesion.length} кластеров с низкой связностью (<40%) — требуют пересмотра`
          );
        }
      }

      if (isVue && result.vueAnalysis) {
        console.log('   • Для Vue компонента рекомендуется выделить composables');
        if (result.vueAnalysis.composables.length === 0) {
          console.log('   • ⚠️ Composables не обнаружены — рекомендуется вынести логику');
        }
        if (result.vueAnalysis.stats.scriptLines > 300) {
          console.log('   • ⚠️ Скрипт слишком большой (>300 строк) — требуется разбиение');
        }
        if (result.vueAnalysis.template && result.vueAnalysis.template.complexity > 50) {
          console.log('   • ⚠️ Шаблон слишком сложный (>50 элементов) — требуется декомпозиция');
        }
      }

      // Следующие шаги
      console.log('\n📋 СЛЕДУЮЩИЕ ШАГИ:');
      console.log('   1. Откройте сгенерированный промпт:');
      console.log(`      ${path.resolve(options.output)}`);
      console.log('   2. Скопируйте содержимое и отправьте в AI (ChatGPT/Claude/Gemini)');
      console.log('   3. Получите готовую структуру модулей');
      console.log('   4. Примените изменения с помощью команды:');
      console.log(`      npx ast-analyzer refactor ${file} --out-dir modules`);
      console.log('   5. Проверьте результат:');
      console.log('      npx ast-analyzer validate ${file}');

      if (isVue) {
        console.log('   6. Для Vue компонента дополнительно:');
        console.log('      npx ast-analyzer vue ${file}');
      }

      console.log('\n' + '='.repeat(70));
      console.log('✅ АНАЛИЗ ЗАВЕРШЕН!');
      console.log('='.repeat(70) + '\n');
    } catch (error) {
      console.error('❌ Ошибка при выполнении split-module:', error);
      if (options.verbose && error instanceof Error && error.stack) {
        console.error('\n📚 Стек ошибки:');
        console.error(error.stack);
      }
      process.exit(1);
    }
  }

  /**
   * Получить имя команды
   */
  getName(): string {
    return 'split-module';
  }

  /**
   * Получить описание команды
   */
  getDescription(): string {
    return '🔪 Split file into modules - generate AI prompt with analysis';
  }
}

// ============================================
// ЭКСПОРТ ДЛЯ ИСПОЛЬЗОВАНИЯ В КАЧЕСТВЕ БИБЛИОТЕКИ
// ============================================

export interface SplitModuleCommandOptions {
  file: string;
  output?: string;
  targetSize?: number;
  maxSize?: number;
  maxDepth?: number;
  exclude?: string[];
  prefix?: string;
  includeFullCode?: boolean;
  includeMinified?: boolean;
  includeGraph?: boolean;
  includeStats?: boolean;
  includeSuggestions?: boolean;
  includeVueAnalysis?: boolean;
  verbose?: boolean;
  vueOnly?: boolean;
  format?: 'markdown' | 'json';
}

/**
 * Выполняет split-module как функцию (для программного использования)
 */
export async function runSplitModule(
  file: string,
  options: SplitModuleCommandOptions = { file: '' }
): Promise<any> {
  const { buildSplitModulePrompt } = await import('../../modes/split-module.js');

  const splitOptions = {
    outputFile: options.output || 'ai-split-module-prompt.md',
    targetClusterSize: options.targetSize || 3,
    maxClusterSize: options.maxSize || 10,
    maxDepth: options.maxDepth || 5,
    excludePatterns: options.exclude || ['node_modules', 'dist', 'build', '.git'],
    prefix: options.prefix || '',
    includeFullCode: options.includeFullCode !== false,
    includeMinified: options.includeMinified !== false,
    includeGraph: options.includeGraph !== false,
    includeStats: options.includeStats !== false,
    includeSuggestions: options.includeSuggestions !== false,
    includeVueAnalysis: options.includeVueAnalysis !== false,
    verbose: options.verbose || false,
    vueOnly: options.vueOnly || false,
    format: options.format || 'markdown',
  };

  return buildSplitModulePrompt(file, splitOptions);
}

// Экспорт по умолчанию
export default SplitModuleCommand;
