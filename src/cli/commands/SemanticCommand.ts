// packages/ast-analyzer/src/cli/commands/SemanticCommand.ts
// ============================================
// ИСПРАВЛЕННАЯ ВЕРСИЯ
// ============================================
// Исправления:
//   1. Убран локальный collectFiles — используется единый
//      collectFilesForAnalysis из '../../ci-cd/index.js'.
//   2. Все пути к SemanticPipeline — через public API
//      '../../ci-cd/index.js' (не напрямую).
//   3. Убраны дублирующиеся списки extensions и ignore-паттернов.
//   4. Типы приведены к единому источнику — PipelineResult
//      из '../../ci-cd/index.js'.
//   5. Убран самописный анализ issues — используется
//      PipelineResult.metrics и PipelineResult.issues.
// ============================================

import { Command } from 'commander';
import path from 'path';
import fs from 'fs';

// ✅ ЕДИНЫЙ ИСТОЧНИК ФАЙЛОВ И PIPELINE
import { SemanticPipeline } from '../../ci-cd/SemanticPipeline.js';
import { collectFilesForAnalysis } from '../../ci-cd/index.js';
import type { PipelineResult, PipelineIssue } from '../../ci-cd/SemanticPipeline.js';
// ============================================
// ТИПЫ
// ============================================

/**
 * Опции команды `semantic`.
 */
export interface SemanticCommandOptions {
  /** Рекурсивный поиск файлов */
  recursive?: boolean;
  /** Включить формальную верификацию Z3 */
  formal?: boolean;
  /** Максимальная глубина анализа Call Graph */
  maxDepth?: string;
  /** Критические функции для верификации (через запятую) */
  critical?: string;
  /** Директория для сохранения отчётов */
  output?: string;
  /** Формат отчёта */
  format?: 'json' | 'html' | 'markdown';
  /** Отключить CFG анализ */
  cfg?: boolean;
  /** Отключить Call Graph анализ */
  callgraph?: boolean;
  /** Отключить Data Flow анализ */
  dataflow?: boolean;
  /** Отключить TypeScript анализ */
  typescript?: boolean;
  /** Отключить JSX/TSX анализ */
  jsx?: boolean;
  /** Отключить Vue анализ */
  vue?: boolean;
  /** Подробный вывод */
  verbose?: boolean;
}

/**
 * Минимальная JSON-схема отчёта (для сохранения на диск).
 */
interface SemanticReportJson {
  success: boolean;
  metrics: PipelineResult['metrics'];
  issues: Array<{
    type: PipelineIssue['type'];
    severity: PipelineIssue['severity'];
    file: string;
    line: number;
    message: string;
    suggestion?: string;
  }>;
  verificationResults: PipelineResult['verificationResults'];
  timestamp: string;
  duration: number;
}

// ============================================
// КОМАНДА
// ============================================

/**
 * Команда для семантического анализа кода.
 *
 * Выполняет:
 *   - CFG (Control Flow Graph) анализ
 *   - Call Graph анализ
 *   - Data Flow анализ
 *   - TypeScript анализ
 *   - JSX/TSX анализ
 *   - Vue анализ
 *   - Формальную верификацию через Z3 (опционально)
 *   - Генерацию отчётов в разных форматах
 *
 * ⚠️ ВАЖНО: команда НЕ собирает файлы самостоятельно.
 * Сбор делегирован в `collectFilesForAnalysis` из `ci-cd/index.js`.
 * Это гарантирует единый список расширений и ignore-паттернов.
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
      .action(async (paths: string[], options: SemanticCommandOptions) => {
        try {
          await this.execute(paths, options);
        } catch (error) {
          console.error('❌ Semantic analysis failed:', error);
          process.exit(1);
        }
      });
  }

  /**
   * Выполняет семантический анализ.
   *
   * @param paths — список путей (файлы и/или директории)
   * @param options — опции команды
   */
  private async execute(paths: string[], options: SemanticCommandOptions): Promise<void> {
    // ────────────────────────────────────────────────────────
    // Шаг 1: Вывод шапки
    // ────────────────────────────────────────────────────────
    console.log('\n' + '='.repeat(70));
    console.log('🔬 ПОЛНЫЙ СЕМАНТИЧЕСКИЙ АНАЛИЗ');
    console.log('='.repeat(70));
    console.log(`📁 Пути: ${paths.join(', ')}`);
    console.log(`📏 Глубина: ${options.maxDepth}`);
    console.log(`🔬 Формальная верификация: ${options.formal ? 'ВКЛЮЧЕНА' : 'ВЫКЛЮЧЕНА'}`);
    console.log(`📄 Формат отчёта: ${options.format}`);
    console.log(`📁 Выходная директория: ${options.output}`);
    console.log('');

    // ────────────────────────────────────────────────────────
    // Шаг 2: Сбор файлов через единый API
    // ────────────────────────────────────────────────────────
    // ⚠️ РАНЬШЕ здесь был локальный collectFiles с дублирующимися
    //    списками extensions и ignore-паттернов.
    //    ТЕПЕРЬ используется collectFilesForAnalysis из ci-cd/index.js,
    //    что гарантирует единый список расширений и исключений
    //    для всех CLI-команд.
    // ────────────────────────────────────────────────────────
    const files = await collectFilesForAnalysis(paths, options.recursive !== false);

    if (files.length === 0) {
      console.error('❌ Не найдено файлов для анализа');
      process.exit(1);
    }

    console.log(`📊 Найдено файлов: ${files.length}`);
    console.log('');

    // ────────────────────────────────────────────────────────
    // Шаг 3: Вывод статуса анализаторов
    // ────────────────────────────────────────────────────────
    console.log('📋 АКТИВНЫЕ АНАЛИЗАТОРЫ:');
    console.log(`   • CFG Analysis: ${options.cfg !== false ? '✅' : '❌'}`);
    console.log(`   • Call Graph: ${options.callgraph !== false ? '✅' : '❌'}`);
    console.log(`   • Data Flow: ${options.dataflow !== false ? '✅' : '❌'}`);
    console.log(`   • TypeScript: ${options.typescript !== false ? '✅' : '❌'}`);
    console.log(`   • JSX/TSX: ${options.jsx !== false ? '✅' : '❌'}`);
    console.log(`   • Vue: ${options.vue !== false ? '✅' : '❌'}`);
    console.log(`   • Formal Verification: ${options.formal ? '✅' : '❌'}`);
    console.log('');

    // ────────────────────────────────────────────────────────
    // Шаг 4: Парсинг критических функций
    // ────────────────────────────────────────────────────────
    let criticalFunctions: string[] = [];
    if (options.critical) {
      criticalFunctions = options.critical
        .split(',')
        .map((f: string) => f.trim())
        .filter(Boolean);

      if (criticalFunctions.length > 0) {
        console.log(`🎯 Критические функции: ${criticalFunctions.join(', ')}`);
        console.log('');
      }
    }

    // ────────────────────────────────────────────────────────
    // Шаг 5: Создание директории для отчётов
    // ────────────────────────────────────────────────────────
    const outputDir = path.resolve(options.output ?? './semantic-reports');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // ────────────────────────────────────────────────────────
    // Шаг 6: Запуск SemanticPipeline
    // ────────────────────────────────────────────────────────
    try {
      const pipeline = new SemanticPipeline();
      const result: PipelineResult = await pipeline.run(files, {
        formalVerification: options.formal === true,
        maxDepth: parseInt(options.maxDepth ?? '5', 10),
        criticalFunctions,
        generateReport: true,
        reportFormat: options.format ?? 'html',
        outputDir: options.output ?? './semantic-reports',
      });

      // ──────────────────────────────────────────────────────
      // Шаг 7: Вывод результатов
      // ──────────────────────────────────────────────────────
      this.printResults(result, options);

      // ──────────────────────────────────────────────────────
      // Шаг 8: Сохранение JSON-отчёта (машинно-читаемого)
      // ──────────────────────────────────────────────────────
      const jsonPath = path.join(outputDir, `semantic-analysis-${Date.now()}.json`);
      const jsonData: SemanticReportJson = {
        success: result.success,
        metrics: result.metrics,
        issues: result.issues.map(issue => ({
          type: issue.type,
          severity: issue.severity,
          file: path.basename(issue.file),
          line: issue.line,
          message: issue.message,
          suggestion: issue.suggestion,
        })),
        verificationResults: result.verificationResults,
        timestamp: result.timestamp,
        duration: result.duration,
      };

      fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2), 'utf-8');
      console.log(`\n📄 JSON отчёт сохранён: ${jsonPath}`);

      // ──────────────────────────────────────────────────────
      // Шаг 9: Дополнительная статистика в verbose-режиме
      // ──────────────────────────────────────────────────────
      if (options.verbose) {
        this.printVerboseStats(result);
      }

      // ──────────────────────────────────────────────────────
      // Шаг 10: Exit code
      // ──────────────────────────────────────────────────────
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
   * Выводит краткие результаты анализа.
   */
  private printResults(result: PipelineResult, options: SemanticCommandOptions): void {
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

    const errors = result.issues.filter(i => i.severity === 'error');
    const warnings = result.issues.filter(i => i.severity === 'warning');
    const info = result.issues.filter(i => i.severity === 'info');

    console.log('\n⚠️ ПРОБЛЕМЫ:');
    console.log(`   • Ошибок: ${errors.length}`);
    console.log(`   • Предупреждений: ${warnings.length}`);
    console.log(`   • Замечаний: ${info.length}`);

    // ──────────────────────────────────────────────────────
    // Ошибки (первые 10)
    // ──────────────────────────────────────────────────────
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

    // ──────────────────────────────────────────────────────
    // Предупреждения (первые 5, только при success)
    // ──────────────────────────────────────────────────────
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

    // ──────────────────────────────────────────────────────
    // Результаты формальной верификации
    // ──────────────────────────────────────────────────────
    if (result.verificationResults && result.verificationResults.length > 0) {
      const verified = result.verificationResults.filter(r => r.isValid);
      const failed = result.verificationResults.filter(r => !r.isValid);

      console.log('\n🔬 ФОРМАЛЬНАЯ ВЕРИФИКАЦИЯ:');
      console.log(`   • Верифицировано: ${verified.length}`);
      console.log(`   • Не верифицировано: ${failed.length}`);

      if (failed.length > 0) {
        console.log('\n   НЕ ВЕРИФИЦИРОВАНЫ:');
        for (const fail of failed.slice(0, 5)) {
          console.log(`   • ${fail.functionName ?? 'unknown'}`);
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
   * Выводит дополнительную статистику (только в verbose-режиме).
   */
  private printVerboseStats(result: PipelineResult): void {
    console.log('\n📊 ДЕТАЛЬНАЯ СТАТИСТИКА:');
    console.log(`   • Всего функций: ${result.metrics.totalFunctions}`);
    console.log(`   • Цикломатическая сложность: ${result.metrics.cyclomaticComplexity}`);
    console.log(`   • Неиспользуемых функций: ${result.metrics.unusedFunctions}`);
    console.log(`   • Неиспользуемых переменных: ${result.metrics.unusedVariables}`);
    console.log(`   • Ошибок типов: ${result.metrics.typeErrors}`);
    console.log(`   • Циклических зависимостей: ${result.metrics.cyclicDependencies}`);
    console.log(`   • Недостижимых блоков: ${result.metrics.unreachableBlocks}`);
    console.log(`   • Верифицировано функций: ${result.metrics.verifiedFunctions}`);

    // JSX статистика
    if (result.jsxAnalysis) {
      console.log('\n⚛️ JSX/TSX СТАТИСТИКА:');
      console.log(`   • JSX элементов: ${result.jsxAnalysis.elements.length}`);
      console.log(`   • Компонентов: ${result.jsxAnalysis.componentProps.size}`);
      console.log(`   • Ошибок пропсов: ${result.jsxAnalysis.propTypeErrors.length}`);
    }
  }

  /**
   * Возвращает команду для регистрации.
   */
  getCommand(): Command {
    return this.program;
  }
}

// ============================================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================================

export default SemanticCommand;
