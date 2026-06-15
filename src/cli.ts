#!/usr/bin/env node

/**
 * CLI entry point for graph-analyzer
 * Handles command-line argument parsing and routing to appropriate modes
 */

import fs from 'fs';
import path from 'path';
import { Graphviz } from '@hpcc-js/wasm-graphviz';

// Core modules
import { minifyForAI } from './core/minifier.js';
import { findCyclicEdges, convertToDOT } from './core/graph-utils.js';
import { setTsConfigPath, loadTsConfig } from './core/tsconfig-resolver.js';

// Mode modules
import { buildProjectGraph } from './modes/project-graph.js';
import { buildFileInternalGraph } from './modes/file-graph.js';
import { buildAiPromptPack } from './modes/prompt-pack.js';
import { buildSplitModulePrompt } from './modes/split-module.js';
import { runImpactAnalysis } from './modes/impact.js';
import { findDeadCode } from './modes/dead-code.js';
import { minifyFolder } from './modes/minify-folder.js';

// Vue analysis
import { analyzeVueComponent, generateVueComponentReport } from './modes/vue-analyzer.js';

// Auto Refactor
import { AutoRefactor } from './refactor/index.js';

// Semantic Analysis (НОВЫЙ МОДУЛЬ!)
import { SemanticPipeline } from './ci-cd/SemanticPipeline.js';
import { Z3Verifier, createIntParam, eq, range } from './formal/Z3Verifier.js';

// Reporters
import { generateHTMLReport } from './reporters/html-reporter.js';

// Types
import type { SplitModuleOptions, MinifyFolderOptions } from './types.js';

// Utils
import { showHelp, DEFAULT_EXCLUDE_PATTERNS } from './utils.js';

// ==========================================
// CLI ARGUMENT PARSING
// ==========================================

interface ParsedArgs {
  mode: string;
  targetPath: string;
  extraArg?: string;
  depthArg?: string;
  outputDir?: string;
  tsconfigPath?: string;
  options?: SplitModuleOptions | MinifyFolderOptions | any;
}

interface GraphResult {
  rootKey: string;
  graph: Record<string, string[]>;
  hasCycles?: boolean;
  cyclicEdges?: string[];
}

function parseArgs(): ParsedArgs | null {
  const args = process.argv.slice(2);
  const mode = args[0];

  let outputDir: string | undefined;
  let tsconfigPath: string | undefined;
  const cleanArgs: string[] = [];

  // Извлекаем -o/--output и --tsconfig из аргументов
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-o' || arg === '--output') {
      if (arg && args[i + 1]) {
        outputDir = args[i + 1];
        i++; // пропускаем значение
      }
    } else if (arg === '--tsconfig') {
      if (args[i + 1]) {
        tsconfigPath = args[i + 1];
        i++;
      }
    } else if (arg) {
      cleanArgs.push(arg);
    }
  }

  // Временно заменяем argv для существующего парсинга
  const originalArgv = [...process.argv];
  const newArgv = [originalArgv[0] || 'node', originalArgv[1] || 'cli.js', ...cleanArgs];
  process.argv = newArgv;

  if (!mode || mode === '--help' || mode === '-h') {
    showHelp();
    process.argv = originalArgv;
    return null;
  }

  // НОВЫЙ РЕЖИМ: semantic - семантический анализ
  if (mode === 'semantic') {
    const targetPaths = cleanArgs.slice(1);
    if (targetPaths.length === 0) {
      console.error('❌ Укажите пути к файлам или директориям для семантического анализа');
      process.argv = originalArgv;
      return null;
    }

    const options: any = {};

    for (let i = 2; i < cleanArgs.length; i++) {
      const arg = cleanArgs[i];
      const nextArg = cleanArgs[i + 1];

      switch (arg) {
        case '--recursive':
        case '-r':
          options.recursive = true;
          break;
        case '--formal':
        case '-f':
          options.formalVerification = true;
          break;
        case '--max-depth':
        case '-d':
          if (nextArg) {
            options.maxDepth = parseInt(nextArg, 10);
            i++;
          }
          break;
        case '--critical':
        case '-c':
          if (nextArg) {
            options.criticalFunctions = nextArg.split(',');
            i++;
          }
          break;
        case '--output':
        case '-o':
          if (nextArg) {
            options.outputDir = nextArg;
            i++;
          }
          break;
      }
    }

    process.argv = originalArgv;
    return {
      mode: 'semantic',
      targetPath: targetPaths[0] || '',
      extraArg: targetPaths.slice(1).join(','),
      options,
      outputDir,
      tsconfigPath,
    };
  }

  // НОВЫЙ РЕЖИМ: verify - формальная верификация функции
  if (mode === 'verify') {
    const targetFile = cleanArgs[1];
    if (!targetFile) {
      console.error('❌ Укажите путь к файлу для верификации');
      process.argv = originalArgv;
      return null;
    }

    const options: any = {};

    for (let i = 2; i < cleanArgs.length; i++) {
      const arg = cleanArgs[i];
      const nextArg = cleanArgs[i + 1];

      switch (arg) {
        case '--function':
        case '-f':
          if (nextArg) {
            options.functionName = nextArg;
            i++;
          }
          break;
        case '--contract':
        case '-c':
          if (nextArg) {
            options.contractPath = nextArg;
            i++;
          }
          break;
      }
    }

    process.argv = originalArgv;
    return { mode: 'verify', targetPath: targetFile, options, outputDir, tsconfigPath };
  }

  // Режим: refactor - автоматический рефакторинг с выделением модулей
  if (mode === 'refactor') {
    const targetPath = cleanArgs[1];
    if (!targetPath) {
      console.error('❌ Укажите путь к файлу для рефакторинга');
      process.argv = originalArgv;
      return null;
    }

    const options: any = {};

    for (let i = 2; i < cleanArgs.length; i++) {
      const arg = cleanArgs[i];
      const nextArg = cleanArgs[i + 1];

      switch (arg) {
        case '--out-dir':
        case '-o':
          if (nextArg) {
            options.modulesDir = nextArg;
            i++;
          }
          break;
        case '--target-size':
        case '-t':
          if (nextArg) {
            options.targetClusterSize = parseInt(nextArg, 10);
            i++;
          }
          break;
        case '--max-size':
        case '-m':
          if (nextArg) {
            options.maxClusterSize = parseInt(nextArg, 10);
            i++;
          }
          break;
        case '--min-cohesion':
        case '-c':
          if (nextArg) {
            options.minCohesionScore = parseInt(nextArg, 10);
            i++;
          }
          break;
        case '--dry-run':
        case '-d':
          options.dryRun = true;
          break;
        case '--no-backup':
          options.createBackup = false;
          break;
        case '--no-vue':
          options.updateTemplate = false;
          break;
        case '--verbose':
        case '-v':
          options.verbose = true;
          break;
        case '--semantic':
        case '-s':
          options.semanticAnalysis = true;
          break;
      }
    }

    process.argv = originalArgv;
    return { mode: 'refactor', targetPath, options, outputDir, tsconfigPath };
  }

  // Режим: analyze - анализ файла без изменений
  if (mode === 'analyze') {
    const targetPath = cleanArgs[1];
    if (!targetPath) {
      console.error('❌ Укажите путь к файлу для анализа');
      process.argv = originalArgv;
      return null;
    }

    const options: any = { dryRun: true };

    for (let i = 2; i < cleanArgs.length; i++) {
      const arg = cleanArgs[i];
      const nextArg = cleanArgs[i + 1];

      switch (arg) {
        case '--target-size':
        case '-t':
          if (nextArg) {
            options.targetClusterSize = parseInt(nextArg, 10);
            i++;
          }
          break;
        case '--max-size':
        case '-m':
          if (nextArg) {
            options.maxClusterSize = parseInt(nextArg, 10);
            i++;
          }
          break;
        case '--min-cohesion':
        case '-c':
          if (nextArg) {
            options.minCohesionScore = parseInt(nextArg, 10);
            i++;
          }
          break;
      }
    }

    process.argv = originalArgv;
    return { mode: 'analyze', targetPath, options, outputDir, tsconfigPath };
  }

  // Mode: vue-analyze
  if (mode === 'vue-analyze' || mode === 'vue') {
    const targetPath = cleanArgs[1];
    if (!targetPath) {
      console.error('❌ Укажите путь к Vue файлу');
      process.argv = originalArgv;
      return null;
    }

    if (!targetPath.endsWith('.vue')) {
      console.error('❌ Файл должен иметь расширение .vue');
      process.argv = originalArgv;
      return null;
    }

    const options = {
      includeTemplateAST: true,
      includeScriptAST: true,
      extractComposableCalls: true,
    };

    for (let i = 2; i < cleanArgs.length; i++) {
      const arg = cleanArgs[i];
      switch (arg) {
        case '--no-template-ast':
          options.includeTemplateAST = false;
          break;
        case '--no-script-ast':
          options.includeScriptAST = false;
          break;
        case '--no-composables':
          options.extractComposableCalls = false;
          break;
      }
    }

    process.argv = originalArgv;
    return { mode: 'vue-analyze', targetPath, options: options as any, outputDir, tsconfigPath };
  }

  // Mode: split-module
  if (mode === 'split-module' || mode === 'split') {
    const targetPath = cleanArgs[1];
    if (!targetPath) {
      console.error('❌ Укажите путь к файлу');
      process.argv = originalArgv;
      return null;
    }

    const options: SplitModuleOptions = {
      outputFile: 'ai-split-module-prompt.md',
      includeFullCode: true,
      includeMinified: true,
      includeGraph: true,
      includeStats: true,
      includeSuggestions: true,
      targetClusterSize: 3,
      maxClusterSize: 10,
      maxDepth: 5,
      excludePatterns: [...DEFAULT_EXCLUDE_PATTERNS],
      prefix: '',
    };

    for (let i = 2; i < cleanArgs.length; i++) {
      const arg = cleanArgs[i];
      const nextArg = cleanArgs[i + 1];

      switch (arg) {
        case '--output':
        case '-o':
          if (nextArg !== undefined) {
            options.outputFile = nextArg;
            i++;
          }
          break;
        case '--target-cluster-size':
        case '-t':
          if (nextArg !== undefined) {
            options.targetClusterSize = parseInt(nextArg, 10);
            i++;
          }
          break;
        case '--max-cluster-size':
        case '-m':
          if (nextArg !== undefined) {
            options.maxClusterSize = parseInt(nextArg, 10);
            i++;
          }
          break;
        case '--max-depth':
        case '-d':
          if (nextArg !== undefined) {
            options.maxDepth = parseInt(nextArg, 10);
            i++;
          }
          break;
        case '--exclude':
        case '-x':
          if (nextArg !== undefined) {
            options.excludePatterns = nextArg.split(',').map(e => e.trim());
            i++;
          }
          break;
        case '--prefix':
        case '-p':
          if (nextArg !== undefined) {
            options.prefix = nextArg;
            i++;
          }
          break;
        case '--no-full-code':
          options.includeFullCode = false;
          break;
        case '--no-minified':
          options.includeMinified = false;
          break;
        case '--no-graph':
          options.includeGraph = false;
          break;
        case '--no-stats':
          options.includeStats = false;
          break;
        case '--no-suggestions':
          options.includeSuggestions = false;
          break;
      }
    }

    process.argv = originalArgv;
    return { mode: 'split-module', targetPath, options, outputDir, tsconfigPath };
  }

  // Mode: minify-folder
  if (mode === 'minify-folder') {
    const targetPath = cleanArgs[1];
    if (!targetPath) {
      console.error('❌ Укажите путь к каталогу');
      process.argv = originalArgv;
      return null;
    }

    const options: MinifyFolderOptions = {
      outputFile: 'ai-project-context.md',
      showStructure: true,
      addTableOfContents: true,
      sortByType: true,
      maxDepth: 10,
      extensions: ['.js', '.ts', '.tsx', '.jsx', '.vue', '.mjs', '.cjs'],
      excludePatterns: [...DEFAULT_EXCLUDE_PATTERNS],
    };

    for (let i = 2; i < cleanArgs.length; i++) {
      const arg = cleanArgs[i];
      const nextArg = cleanArgs[i + 1];

      switch (arg) {
        case '--output':
        case '-o':
          if (nextArg !== undefined) {
            options.outputFile = nextArg;
            i++;
          }
          break;
        case '--depth':
        case '-d':
          if (nextArg !== undefined) {
            options.maxDepth = parseInt(nextArg, 10);
            i++;
          }
          break;
        case '--extensions':
        case '-e':
          if (nextArg !== undefined) {
            options.extensions = nextArg.split(',').map(e => e.trim().toLowerCase());
            i++;
          }
          break;
        case '--exclude':
        case '-x':
          if (nextArg !== undefined) {
            options.excludePatterns = nextArg.split(',').map(e => e.trim());
            i++;
          }
          break;
        case '--no-structure':
          options.showStructure = false;
          break;
        case '--no-toc':
          options.addTableOfContents = false;
          break;
      }
    }

    process.argv = originalArgv;
    return { mode: 'minify-folder', targetPath, options, outputDir, tsconfigPath };
  }

  // Mode: dead-code
  if (mode === 'dead-code') {
    const targetPath = cleanArgs[1];
    if (!targetPath) {
      console.error('❌ Укажите путь к файлу');
      process.argv = originalArgv;
      return null;
    }
    process.argv = originalArgv;
    return { mode: 'dead-code', targetPath, extraArg: '', depthArg: '', outputDir, tsconfigPath };
  }

  // Mode: impact
  if (mode === 'impact') {
    const targetPath = cleanArgs[1];
    const entityName = cleanArgs[2];
    if (!targetPath || !entityName) {
      console.error('❌ Укажите файл и сущность: impact <файл> <entity>');
      process.argv = originalArgv;
      return null;
    }
    process.argv = originalArgv;
    return {
      mode: 'impact',
      targetPath,
      extraArg: entityName,
      depthArg: '',
      outputDir,
      tsconfigPath,
    };
  }

  // Mode: prompt-pack
  if (mode === 'prompt-pack') {
    const targetPath = cleanArgs[1];
    const depth = cleanArgs[2];
    if (!targetPath) {
      console.error('❌ Укажите путь к файлу');
      process.argv = originalArgv;
      return null;
    }
    process.argv = originalArgv;
    return {
      mode: 'prompt-pack',
      targetPath,
      extraArg: depth,
      depthArg: '',
      outputDir,
      tsconfigPath,
    };
  }

  // Mode: minify (single file)
  if (mode === 'minify') {
    const targetPath = cleanArgs[1];
    if (!targetPath) {
      console.error('❌ Укажите путь к файлу');
      process.argv = originalArgv;
      return null;
    }
    process.argv = originalArgv;
    return { mode: 'minify', targetPath, extraArg: '', depthArg: '', outputDir, tsconfigPath };
  }

  // Mode: project (graph)
  if (mode === 'project') {
    const targetPath = cleanArgs[1];
    const maxDepth = cleanArgs[2];
    if (!targetPath) {
      console.error('❌ Укажите путь к файлу');
      process.argv = originalArgv;
      return null;
    }
    process.argv = originalArgv;
    return {
      mode: 'project',
      targetPath,
      extraArg: maxDepth,
      depthArg: '',
      outputDir,
      tsconfigPath,
    };
  }

  // Mode: file (internal graph)
  if (mode === 'file') {
    const targetPath = cleanArgs[1];
    if (!targetPath) {
      console.error('❌ Укажите путь к файлу');
      process.argv = originalArgv;
      return null;
    }
    process.argv = originalArgv;
    return { mode: 'file', targetPath, extraArg: '', depthArg: '', outputDir, tsconfigPath };
  }

  console.error(`❌ Неизвестный режим: ${mode}`);
  showHelp();
  process.argv = originalArgv;
  return null;
}

// ==========================================
// MAIN CLI ENTRY POINT
// ==========================================

export async function runCLI(): Promise<void> {
  const parsed = parseArgs();
  if (!parsed) return;

  const { mode, targetPath, extraArg, options, outputDir, tsconfigPath } = parsed;

  // Сохраняем исходную директорию СРАЗУ
  const originalCwd = process.cwd();

  // 1. СНАЧАЛА обрабатываем tsconfig (до смены директории)
  if (tsconfigPath) {
    const resolvedTsconfig = path.isAbsolute(tsconfigPath)
      ? tsconfigPath
      : path.resolve(originalCwd, tsconfigPath);

    if (fs.existsSync(resolvedTsconfig)) {
      setTsConfigPath(resolvedTsconfig);
      console.log(`📄 TsConfig: ${resolvedTsconfig}`);

      // Дополнительно загружаем и показываем алиасы
      const tsConfig = loadTsConfig(path.dirname(resolvedTsconfig));
      if (tsConfig?.compilerOptions?.paths) {
        console.log('🔗 Найдены алиасы в tsconfig:');
        Object.entries(tsConfig.compilerOptions.paths).forEach(([alias, targets]) => {
          console.log(`   ${alias} → ${targets[0]}`);
        });
      }
    } else {
      console.warn(`⚠️ TsConfig не найден: ${resolvedTsconfig}`);
      console.warn(`   Искали: ${resolvedTsconfig}`);
    }
  }

  // 2. ПОТОМ обрабатываем outputDir и меняем директорию
  let outputDirChanged = false;
  let currentTargetPath = targetPath;

  if (outputDir) {
    // Создаем директорию если её нет (относительно originalCwd)
    const absoluteOutputDir = path.resolve(originalCwd, outputDir);
    if (!fs.existsSync(absoluteOutputDir)) {
      fs.mkdirSync(absoluteOutputDir, { recursive: true });
      console.log(`📁 Создана выходная директория: ${absoluteOutputDir}`);
    }

    // Преобразуем targetPath в абсолютный путь относительно исходной директории
    if (!path.isAbsolute(targetPath)) {
      currentTargetPath = path.resolve(originalCwd, targetPath);
      console.log('📄 Преобразован относительный путь в абсолютный:');
      console.log(`   Было: ${targetPath}`);
      console.log(`   Стало: ${currentTargetPath}`);
    }

    // Проверяем существование файла
    if (!fs.existsSync(currentTargetPath)) {
      console.error(`❌ Файл не найден: ${currentTargetPath}`);
      process.exit(1);
    }

    // Меняем рабочую директорию
    process.chdir(absoluteOutputDir);
    outputDirChanged = true;
    console.log(`📂 Выходная директория: ${process.cwd()}\n`);
  }

  try {
    // НОВЫЙ РЕЖИМ: semantic - семантический анализ
    if (mode === 'semantic') {
      console.log(`\n${'='.repeat(60)}`);
      console.log('🔬 СЕМАНТИЧЕСКИЙ АНАЛИЗ КОДА');
      console.log(`${'='.repeat(60)}\n`);

      // Собираем все пути
      let paths: string[] = [currentTargetPath];
      if (extraArg) {
        paths = paths.concat(extraArg.split(','));
      }

      const pipeline = new SemanticPipeline();
      const result = await pipeline.run(paths, {
        formalVerification: options?.formalVerification || false,
        maxDepth: options?.maxDepth || 5,
        criticalFunctions: options?.criticalFunctions || [],
      });

      if (!result.success) {
        process.exit(1);
      }
      return;
    }

    // НОВЫЙ РЕЖИМ: verify - формальная верификация
    if (mode === 'verify') {
      console.log(`\n${'='.repeat(60)}`);
      console.log('🔬 ФОРМАЛЬНАЯ ВЕРИФИКАЦИЯ');
      console.log(`${'='.repeat(60)}\n`);

      const z3 = new Z3Verifier();
      await z3.initialize();

      // Загружаем контракт из файла или создаем на основе анализа
      let contract: any = null;

      if (options?.contractPath && fs.existsSync(options.contractPath)) {
        const contractContent = fs.readFileSync(options.contractPath, 'utf-8');
        contract = JSON.parse(contractContent);
      } else {
        // Создаем контракт для функции на основе имени
        console.log(`🔍 Анализ функции: ${options?.functionName || 'не указана'}`);

        // Пример контракта для демонстрации
        contract = {
          name: options?.functionName || 'testFunction',
          params: [createIntParam('x'), createIntParam('y')],
          returnType: 'int',
          preconditions: [range('x', 0, 100), range('y', 0, 100)],
          postconditions: [eq('result', { left: 'x', right: 'y', type: 'equality' } as any)],
          invariants: [],
        };
      }

      console.log('\n📋 Контракт для верификации:');
      console.log(`   Функция: ${contract.name}`);
      console.log(
        `   Параметры: ${contract.params.map((p: any) => `${p.name}:${p.type}`).join(', ')}`
      );
      console.log(`   Возврат: ${contract.returnType}`);
      console.log(`   Предусловий: ${contract.preconditions.length}`);
      console.log(`   Постусловий: ${contract.postconditions.length}`);

      const result = await z3.verifyFunction(contract);

      if (result.isValid) {
        console.log('\n✅ Функция ВЕРИФИЦИРОВАНА!');
        console.log(`   ${contract.name} удовлетворяет всем контрактам`);
      } else {
        console.log('\n❌ Функция НЕ ВЕРИФИЦИРОВАНА!');
        if (result.counterexample) {
          console.log('\n🔍 Контрпример:');
          for (const [key, value] of result.counterexample) {
            console.log(`   ${key} = ${value}`);
          }
        }
        if (result.error) {
          console.log(`\n⚠️ Ошибка: ${result.error}`);
        }
        process.exit(1);
      }

      await z3.dispose();
      return;
    }

    // Режим: refactor - автоматический рефакторинг
    if (mode === 'refactor') {
      console.log(`\n${'='.repeat(60)}`);
      console.log('🔧 АВТОМАТИЧЕСКИЙ РЕФАКТОРИНГ');
      console.log(`${'='.repeat(60)}\n`);

      const refactor = new AutoRefactor({
        modulesDir: options?.modulesDir || 'modules',
        targetClusterSize: options?.targetClusterSize || 3,
        maxClusterSize: options?.maxClusterSize || 10,
        minCohesionScore: options?.minCohesionScore || 60,
        updateTemplate: options?.updateTemplate !== false,
        dryRun: options?.dryRun || false,
        createBackup: options?.createBackup !== false,
        verbose: options?.verbose || false,
      });

      const result = await refactor.refactor(currentTargetPath);

      // Если включен семантический анализ, проверяем результат
      if (options?.semanticAnalysis && result.success && !options?.dryRun) {
        console.log(`\n${'='.repeat(60)}`);
        console.log('🔬 СЕМАНТИЧЕСКАЯ ПРОВЕРКА РЕЗУЛЬТАТА');
        console.log(`${'='.repeat(60)}\n`);

        const pipeline = new SemanticPipeline();
        const semanticResult = await pipeline.run([currentTargetPath], {
          formalVerification: false,
          maxDepth: 3,
        });

        if (!semanticResult.success) {
          console.log('\n⚠️ ВНИМАНИЕ: Семантический анализ выявил проблемы!');
          console.log('   Проверьте отчет для деталей.');
        }
      }

      if (!result.success) {
        console.error(`❌ Рефакторинг не удался: ${result.error}`);
        process.exit(1);
      }

      console.log('\n✨ Рефакторинг успешно завершён!');
      if (result.modules && result.modules.length > 0) {
        console.log(`📦 Создано модулей: ${result.modules.length}`);
        for (let i = 0; i < result.modules.length; i++) {
          const module = result.modules[i];
          if (!module) continue;
          console.log(`   ${i + 1}. ${module.name} (${module.exports.length} экспортов)`);
        }
      }
      if (result.backupPath) {
        console.log(`💾 Бэкап: ${result.backupPath}`);
      }
      return;
    }

    // Режим: analyze - анализ без изменений
    if (mode === 'analyze') {
      console.log(`\n${'='.repeat(60)}`);
      console.log('🔍 АНАЛИЗ ФАЙЛА (без изменений)');
      console.log(`${'='.repeat(60)}\n`);

      const refactor = new AutoRefactor({
        targetClusterSize: options?.targetClusterSize || 3,
        maxClusterSize: options?.maxClusterSize || 10,
        minCohesionScore: options?.minCohesionScore || 60,
        dryRun: true,
      });

      const result = await refactor.refactor(currentTargetPath);

      if (result.modules && result.modules.length > 0) {
        console.log(`\n📊 Найдено кластеров: ${result.modules.length}`);
        for (let i = 0; i < result.modules.length; i++) {
          const module = result.modules[i];
          if (!module) continue;
          console.log(`\n   ${i + 1}. Модуль "${module.name}":`);
          console.log(`      Экспорты: ${module.exports.join(', ')}`);
        }
      } else {
        console.log('\nℹ️ Не найдено кандидатов для выделения в модули');
      }
      return;
    }

    // Режим: vue-analyze
    if (mode === 'vue-analyze' || mode === 'vue') {
      console.log(`\n${'='.repeat(60)}`);
      console.log('🎯 АНАЛИЗ VUE КОМПОНЕНТА');
      console.log(`${'='.repeat(60)}\n`);

      const analysis = analyzeVueComponent(currentTargetPath, options as any);
      if (!analysis) {
        console.error('❌ Не удалось проанализировать Vue компонент');
        process.exit(1);
      }

      // Сохраняем JSON отчет
      const jsonOutput = {
        ...analysis,
        timestamp: new Date().toISOString(),
      };
      fs.writeFileSync('vue-analysis.json', JSON.stringify(jsonOutput, null, 2));
      console.log('✅ JSON анализ сохранен: vue-analysis.json');

      // Сохраняем Markdown отчет
      const markdownReport = generateVueComponentReport(analysis);
      fs.writeFileSync('vue-analysis.md', markdownReport);
      console.log('✅ Markdown отчет сохранен: vue-analysis.md');

      // Выводим краткую информацию
      console.log('\n📊 КРАТКАЯ ИНФОРМАЦИЯ:');
      console.log(`   🏷️  Компонент: ${analysis.componentName}`);
      console.log(`   📥 Props: ${analysis.props.names.length}`);
      console.log(`   📤 Events: ${analysis.emits.names.length}`);
      console.log(`   🎭 Slots: ${analysis.slots.length}`);
      console.log(`   🧩 Composables: ${analysis.composables.length}`);
      console.log(`   📝 Скрипт: ${analysis.stats.scriptLines} строк`);
      console.log(`   🎨 Шаблон: ${analysis.stats.templateLines} строк`);
      console.log(`   🎭 Стили: ${analysis.stats.styleCount} блоков`);
      console.log(`   💻 TypeScript: ${analysis.script.isTS ? '✅' : '❌'}`);
      console.log(`   📦 Setup: ${analysis.script.isSetup ? '✅' : '❌'}`);

      console.log('\n✨ Анализ Vue компонента завершен!');
      return;
    }

    // Mode: split-module
    if (mode === 'split-module' || mode === 'split') {
      console.log(`\n${'='.repeat(60)}`);
      console.log('🔪 РАЗБИЕНИЕ ФАЙЛА НА МОДУЛИ');
      console.log(`${'='.repeat(60)}`);

      const result = buildSplitModulePrompt(currentTargetPath, options as SplitModuleOptions);
      if (result) {
        console.log('\n📋 Инструкция:');
        console.log(`   1. Откройте ${result.outputFiles.prompt}`);
        console.log('   2. Скопируйте содержимое');
        console.log('   3. Отправьте в ChatGPT/Claude/Gemini');
        console.log('   4. Получите готовую структуру модулей');
      }
      return;
    }

    // Mode: minify-folder
    if (mode === 'minify-folder') {
      console.log(`\n${'='.repeat(60)}`);
      console.log('📁 РЕКУРСИВНАЯ МИНИФИКАЦИЯ ПРОЕКТА');
      console.log(`${'='.repeat(60)}`);

      minifyFolder(currentTargetPath, options as MinifyFolderOptions);
      return;
    }

    // Mode: dead-code
    if (mode === 'dead-code') {
      console.log(`🔎 Анализ мертвого кода: ${currentTargetPath}`);
      const report = findDeadCode(currentTargetPath);
      if (report) {
        fs.writeFileSync('ai-dead-code-report.md', report);
        console.log(report);
        console.log('\n✅ Отчет сохранен: ai-dead-code-report.md');
      }
      return;
    }

    // Mode: impact
    if (mode === 'impact') {
      if (!extraArg) {
        console.error('❌ Укажите имя сущности: node graph-analyzer.js impact <файл> <entity>');
        process.exit(1);
      }
      console.log(`💥 Анализ влияния: ${extraArg} в ${currentTargetPath}`);
      const report = runImpactAnalysis(currentTargetPath, extraArg);
      fs.writeFileSync('ai-impact-report.md', report);
      console.log(report);
      console.log('\n✅ Отчет сохранен: ai-impact-report.md');
      return;
    }

    // Mode: prompt-pack
    if (mode === 'prompt-pack') {
      const depth = extraArg ? parseInt(extraArg, 10) : 2;
      console.log(`🎒 Сборка промпт-пака для ${currentTargetPath} (глубина ${depth})`);
      const pack = buildAiPromptPack(currentTargetPath, depth);
      fs.writeFileSync('ai-prompt-bundle.md', pack);
      console.log('\n✅ Пакет сохранен: ai-prompt-bundle.md');
      console.log(`📊 Размер: ${(pack.length / 1024).toFixed(2)} KB`);
      return;
    }

    // Mode: minify (single file)
    if (mode === 'minify') {
      console.log(`✂️ Минификация: ${currentTargetPath}`);
      const minified = minifyForAI(currentTargetPath);
      if (minified) {
        fs.writeFileSync('ai-context.txt', minified);
        console.log('\n✅ Минифицированный код сохранен: ai-context.txt');
        const originalSize = fs.statSync(currentTargetPath).size;
        console.log(`📊 Исходный размер: ${(originalSize / 1024).toFixed(2)} KB`);
        console.log(`📊 Сжатый размер: ${(minified.length / 1024).toFixed(2)} KB`);
        const ratio = ((minified.length / originalSize) * 100).toFixed(1);
        console.log(`📊 Экономия: ${(100 - parseFloat(ratio)).toFixed(1)}% токенов`);
      }
      return;
    }

    // Mode: project (graph)
    if (mode === 'project') {
      const maxDepth = extraArg ? parseInt(extraArg, 10) : Infinity;
      console.log(
        `📁 Построение графа проекта от ${currentTargetPath} (глубина ${maxDepth === Infinity ? '∞' : maxDepth})`
      );

      const resultData = buildProjectGraph(currentTargetPath, maxDepth) as GraphResult;
      if (!resultData || Object.keys(resultData.graph).length === 0) {
        console.log('⚠️ Зависимости не найдены');
        return;
      }

      const cyclicEdges = findCyclicEdges(resultData.graph);
      const hasCycles = cyclicEdges.size > 0;
      resultData.hasCycles = hasCycles;
      resultData.cyclicEdges = Array.from(cyclicEdges);

      fs.writeFileSync('output.json', JSON.stringify(resultData, null, 2));
      console.log(`   ✅ output.json (${Object.keys(resultData.graph).length} узлов)`);

      const dotContent = convertToDOT(resultData, cyclicEdges);
      fs.writeFileSync('output.dot', dotContent);
      console.log('   ✅ output.dot');

      console.log('⚙️ Генерация SVG...');
      const graphviz = await Graphviz.load();
      const svgContent = graphviz.dot(dotContent);
      fs.writeFileSync('output.svg', svgContent);
      console.log('   ✅ output.svg');

      const htmlContent = generateHTMLReport(
        svgContent,
        dotContent,
        JSON.stringify(resultData, null, 2),
        currentTargetPath,
        hasCycles
      );
      fs.writeFileSync('report.html', htmlContent);
      console.log('   ✅ report.html');

      console.log('\n🎉 Готово! Откройте report.html в браузере');

      if (hasCycles) {
        console.log(`\n⚠️ Обнаружено ${cyclicEdges.size} циклических зависимостей:`);
        console.log('='.repeat(60));

        // Группируем по исходному файлу
        const cyclesByFile = new Map<string, Set<string>>();
        for (const edge of cyclicEdges) {
          const parts = edge.split('->');
          const from = parts[0];
          const to = parts[1];
          if (from && to) {
            if (!cyclesByFile.has(from)) cyclesByFile.set(from, new Set());
            cyclesByFile.get(from)!.add(to);
          }
        }

        // Выводим в читаемом формате
        for (const [from, toSet] of cyclesByFile) {
          // Сокращаем длинные пути для читаемости
          const shortFrom = from.length > 80 ? '...' + from.slice(-77) : from;
          console.log(`\n📄 ${shortFrom}`);
          for (const to of toSet) {
            const shortTo = to.length > 80 ? '...' + to.slice(-77) : to;
            console.log(`   └─ 🔄 зависит от: ${shortTo}`);
          }
        }

        console.log(
          '\n💡 Подробная визуализация (с подсветкой циклов красным) доступна в report.html'
        );
      }

      return;
    }

    // Mode: file (internal graph)
    if (mode === 'file') {
      console.log(`📄 Построение внутреннего графа файла ${currentTargetPath}`);

      const resultData = buildFileInternalGraph(currentTargetPath) as GraphResult;
      if (!resultData || Object.keys(resultData.graph).length === 0) {
        console.log('⚠️ Зависимости не найдены');
        return;
      }

      const cyclicEdges = findCyclicEdges(resultData.graph);
      const hasCycles = cyclicEdges.size > 0;
      resultData.hasCycles = hasCycles;
      resultData.cyclicEdges = Array.from(cyclicEdges);

      fs.writeFileSync('output.json', JSON.stringify(resultData, null, 2));
      console.log(`   ✅ output.json (${Object.keys(resultData.graph).length} узлов)`);

      const dotContent = convertToDOT(resultData, cyclicEdges);
      fs.writeFileSync('output.dot', dotContent);
      console.log('   ✅ output.dot');

      console.log('⚙️ Генерация SVG...');
      const graphviz = await Graphviz.load();
      const svgContent = graphviz.dot(dotContent);
      fs.writeFileSync('output.svg', svgContent);
      console.log('   ✅ output.svg');

      const htmlContent = generateHTMLReport(
        svgContent,
        dotContent,
        JSON.stringify(resultData, null, 2),
        currentTargetPath,
        hasCycles
      );
      fs.writeFileSync('report.html', htmlContent);
      console.log('   ✅ report.html');

      console.log('\n🎉 Готово! Откройте report.html в браузере');

      if (hasCycles) {
        console.log(
          `\n⚠️ Обнаружено ${cyclicEdges.size} циклических зависимостей во внутреннем графе файла:`
        );
        console.log('='.repeat(60));

        // Группируем по исходной функции/сущности
        const cyclesByEntity = new Map<string, Set<string>>();
        for (const edge of cyclicEdges) {
          const parts = edge.split('->');
          const from = parts[0];
          const to = parts[1];
          if (from && to) {
            if (!cyclesByEntity.has(from)) cyclesByEntity.set(from, new Set());
            cyclesByEntity.get(from)!.add(to);
          }
        }

        // Выводим в читаемом формате
        for (const [from, toSet] of cyclesByEntity) {
          console.log(`\n📄 ${from}`);
          for (const to of toSet) {
            console.log(`   └─ 🔄 вызывает: ${to} (цикл)`);
          }
        }

        console.log(
          '\n💡 Подробная визуализация (с подсветкой циклов красным) доступна в report.html'
        );
      }

      return;
    }
  } catch (error) {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  } finally {
    // Возвращаемся в исходную директорию
    if (outputDirChanged) {
      process.chdir(originalCwd);
      console.log(`\n📂 Возврат в исходную директорию: ${originalCwd}`);
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCLI().catch(console.error);
}
