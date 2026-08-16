#!/usr/bin/env node
// packages/ast-analyzer/src/cli-semantic.ts

/**
 * CLI для семантического анализа кода
 *
 * Что делает:
 *   - Анализирует граф вызовов (Call Graph)
 *   - Строит граф потока управления (CFG)
 *   - Анализирует типы TypeScript
 *   - Анализирует потоки данных (Data Flow)
 *   - Находит неиспользуемые функции и переменные
 *   - Обнаруживает циклические зависимости
 *   - Опционально: формальная верификация через Z3
 *
 * Использование:
 *   npx ast-semantic analyze <paths...> [options]
 *   npx ast-semantic callgraph <file> [options]
 *   npx ast-semantic cfg <file> [options]
 *   npx ast-semantic types <file> [options]
 *   npx ast-semantic dataflow <file> [options]
 *   npx ast-semantic verify <file> --function <name>
 */

import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

// Импорты из существующих модулей
import { SemanticPipeline, type PipelineResult } from './ci-cd/SemanticPipeline.js';
import { CallGraphAnalyzer, type CallGraph } from './semantic/CallGraphAnalyzer.js';
import { CFGAnalyzer, type ControlFlowGraph } from './semantic/CFGAnalyzer.js';
import { TypeAnalyzer, type TypeAnalysisResult } from './semantic/TypeAnalyzer.js';
import { DataFlowAnalyzer, type DataFlowGraph } from './semantic/DataFlowAnalyzer.js';
import { Z3Verifier, type FunctionContract } from './formal/Z3Verifier.js';
import { Project } from 'ts-morph';

const program = new Command();

program
  .name('ast-semantic')
  .description('🔬 Семантический анализ кода — графы, типы, потоки, верификация')
  .version('3.0.0');

// ============================================
// ЕДИНЫЙ МЕТОД ДЛЯ ВЫХОДА ИЗ ПРОГРАММЫ
// ============================================

export function exitWithCode(code: number): never {
  if (process.env.NODE_ENV === 'test') {
    // В тестовой среде выбрасываем исключение вместо process.exit
    throw new Error(`process.exit called with code ${code}`);
  }
  process.exit(code);
}

export function handleErrorAndExit(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`❌ ${message}`);
  exitWithCode(1);
}

// ============================================
// ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ДЛЯ ПРОВЕРКИ ФАЙЛА
// ============================================

function validateFileExists(filePath: string): string {
  const absolutePath = path.resolve(filePath);
  if (!fs.existsSync(absolutePath)) {
    console.error(`❌ Файл не найден: ${absolutePath}`);
    exitWithCode(1);
  }
  return absolutePath;
}

// ============================================
// КОМАНДА: analyze — полный семантический анализ
// ============================================

program
  .command('analyze <paths...>')
  .description('Полный семантический анализ файлов/директорий')
  .option('-r, --recursive', 'Рекурсивный поиск в директориях', true)
  .option('--formal', 'Включить формальную верификацию через Z3', false)
  .option('--max-depth <n>', 'Максимальная глубина анализа', '5')
  .option('--critical <functions>', 'Критические функции для верификации (через запятую)')
  .option('-o, --output <dir>', 'Директория для сохранения отчётов', './semantic-reports')
  .option('--format <format>', 'Формат отчёта (json, html, markdown)', 'html')
  .option('-v, --verbose', 'Подробный вывод', false)
  .action(async (paths: string[], options: any) => {
    try {
      console.log('\n' + '='.repeat(70));
      console.log('🔬 ПОЛНЫЙ СЕМАНТИЧЕСКИЙ АНАЛИЗ');
      console.log('='.repeat(70));

      const files = await collectFiles(paths, options.recursive);

      if (files.length === 0) {
        console.error('❌ Не найдено файлов для анализа');
        exitWithCode(1);
      }

      console.log(`📁 Найдено файлов: ${files.length}`);
      console.log(`🔬 Формальная верификация: ${options.formal ? 'ВКЛЮЧЕНА' : 'ВЫКЛЮЧЕНА'}`);
      console.log(`📏 Глубина анализа: ${options.maxDepth}`);

      let criticalFunctions: string[] = [];
      if (options.critical) {
        criticalFunctions = options.critical.split(',').map((f: string) => f.trim());
        console.log(`🎯 Критические функции: ${criticalFunctions.join(', ')}`);

        for (const func of criticalFunctions) {
          let found = false;
          for (const file of files) {
            try {
              const content = fs.readFileSync(file, 'utf-8');
              if (
                content.includes(`function ${func}`) ||
                content.includes(`const ${func}`) ||
                content.includes(`export ${func}`) ||
                content.includes(`export default ${func}`)
              ) {
                found = true;
                break;
              }
            } catch (e) {
              // Игнорируем ошибки чтения
            }
          }
          if (!found) {
            console.warn(`⚠️ Критическая функция '${func}' не найдена в анализируемых файлах`);
          }
        }
      }

      console.log(`📄 Формат отчёта: ${options.format}`);
      console.log('');

      const pipeline = new SemanticPipeline();
      const result = await pipeline.run(files, {
        formalVerification: options.formal,
        maxDepth: parseInt(options.maxDepth),
        criticalFunctions: criticalFunctions,
        generateReport: true,
        reportFormat: options.format,
        outputDir: options.output,
      });

      printAnalysisReport(result);

      // Сохраняем JSON отчёт для машинной обработки
      const reportDir = options.output || './semantic-reports';
      if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
      }

      const jsonPath = path.join(reportDir, `semantic-analysis-${Date.now()}.json`);
      fs.writeFileSync(
        jsonPath,
        JSON.stringify(
          {
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
          },
          null,
          2
        )
      );

      console.log(`\n📄 JSON отчёт сохранён: ${jsonPath}`);

      exitWithCode(0);
    } catch (error) {
      handleErrorAndExit(error);
    }
  });

// ============================================
// КОМАНДА: callgraph — граф вызовов
// ============================================

program
  .command('callgraph <file>')
  .description('Построить граф вызовов (Call Graph) для файла')
  .option('--max-depth <n>', 'Максимальная глубина', '5')
  .option('--json', 'Вывод в JSON формате', false)
  .option('--dot', 'Вывод в DOT формате для Graphviz', false)
  .option('-o, --output <file>', 'Сохранить в файл')
  .action(async (file: string, options: any) => {
    try {
    console.log('-------------------------------------------------')
      console.log('\n' + '='.repeat(70));
      console.log('🕸️ АНАЛИЗ ГРАФА ВЫЗОВОВ');
      console.log('='.repeat(70));
      console.log(`📄 Файл: ${file}`);

      // ✅ ПРОВЕРКА СУЩЕСТВОВАНИЯ ФАЙЛА
      const absolutePath = validateFileExists(file);

      const analyzer = new CallGraphAnalyzer();
      const callGraph = await analyzer.analyzeSingle(absolutePath, parseInt(options.maxDepth));

      if (options.json) {
        const jsonData = analyzer.exportToJSON(true);
        console.log(JSON.stringify(jsonData, null, 2));
      } else if (options.dot) {
        console.log(generateDotFromCallGraph(callGraph));
      } else {
        printCallGraphReport(callGraph, absolutePath);
      }

      if (options.output) {
        const outputPath = path.resolve(options.output);
        const ext = path.extname(outputPath);
        let content: string;

        if (ext === '.json') {
          content = JSON.stringify(analyzer.exportToJSON(true), null, 2);
        } else if (ext === '.dot') {
          content = generateDotFromCallGraph(callGraph);
        } else {
          content = generateCallGraphMarkdown(callGraph, absolutePath);
        }

        fs.writeFileSync(outputPath, content);
        console.log(`\n📄 Сохранено: ${outputPath}`);
      }

      exitWithCode(0);
    } catch (error) {
      console.error('❌ Ошибка при построении графа вызовов:', error);
      exitWithCode(1);
    }
  });

// ============================================
// КОМАНДА: cfg — граф потока управления
// ============================================

program
  .command('cfg <file>')
  .description('Построить граф потока управления (CFG) для файла')
  .option('--json', 'Вывод в JSON формате', false)
  .option('--dot', 'Вывод в DOT формате для Graphviz', false)
  .option('-o, --output <file>', 'Сохранить в файл')
  .action(async (file: string, options: any) => {
    try {
      console.log('\n' + '='.repeat(70));
      console.log('🔀 АНАЛИЗ ПОТОКА УПРАВЛЕНИЯ');
      console.log('='.repeat(70));
      console.log(`📄 Файл: ${file}`);

      // ✅ ПРОВЕРКА СУЩЕСТВОВАНИЯ ФАЙЛА
      const absolutePath = validateFileExists(file);

      const project = new Project({
        compilerOptions: {
          target: 99,
          module: 99,
          allowJs: true,
          checkJs: false,
          skipLibCheck: true,
        },
      });

      const sourceFile = project.addSourceFileAtPath(absolutePath);
      const analyzer = new CFGAnalyzer();
      const cfg = analyzer.build(sourceFile);

      if (options.json) {
        const jsonData = exportCFGToJSON(cfg);
        console.log(JSON.stringify(jsonData, null, 2));
      } else if (options.dot) {
        console.log(generateDotFromCFG(cfg));
      } else {
        printCFGReport(cfg, absolutePath);
      }

      if (options.output) {
        const outputPath = path.resolve(options.output);
        const ext = path.extname(outputPath);
        let content: string;

        if (ext === '.json') {
          content = JSON.stringify(exportCFGToJSON(cfg), null, 2);
        } else if (ext === '.dot') {
          content = generateDotFromCFG(cfg);
        } else {
          content = generateCFGMarkdown(cfg, absolutePath);
        }

        fs.writeFileSync(outputPath, content);
        console.log(`\n📄 Сохранено: ${outputPath}`);
      }

      exitWithCode(0);
    } catch (error) {
      console.error('❌ Ошибка при построении графа потока управления:', error);
      exitWithCode(1);
    }
  });

// ============================================
// КОМАНДА: types — анализ типов
// ============================================

program
  .command('types <file>')
  .description('Анализ типов TypeScript в файле')
  .option('--json', 'Вывод в JSON формате', false)
  .option('-o, --output <file>', 'Сохранить в файл')
  .action(async (file: string, options: any) => {
    try {
      console.log('\n' + '='.repeat(70));
      console.log('📝 АНАЛИЗ ТИПОВ TYPESCRIPT');
      console.log('='.repeat(70));
      console.log(`📄 Файл: ${file}`);

      // ✅ ПРОВЕРКА СУЩЕСТВОВАНИЯ ФАЙЛА
      const absolutePath = validateFileExists(file);

      const analyzer = new TypeAnalyzer(absolutePath);
      const result = analyzer.analyze();

      if (options.json) {
        const jsonData = exportTypeAnalysisToJSON(result);
        console.log(JSON.stringify(jsonData, null, 2));
      } else {
        printTypeReport(result, absolutePath);
      }

      if (options.output) {
        const outputPath = path.resolve(options.output);
        const ext = path.extname(outputPath);
        let content: string;

        if (ext === '.json') {
          content = JSON.stringify(exportTypeAnalysisToJSON(result), null, 2);
        } else {
          content = generateTypeMarkdown(result, absolutePath);
        }

        fs.writeFileSync(outputPath, content);
        console.log(`\n📄 Сохранено: ${outputPath}`);
      }

      exitWithCode(0);
    } catch (error) {
      console.error('❌ Ошибка при анализе типов:', error);
      exitWithCode(1);
    }
  });

// ============================================
// КОМАНДА: dataflow — анализ потока данных
// ============================================

program
  .command('dataflow <file>')
  .description('Анализ потока данных (Data Flow) в файле')
  .option('--json', 'Вывод в JSON формате', false)
  .option('--dot', 'Вывод в DOT формате для Graphviz', false)
  .option('-o, --output <file>', 'Сохранить в файл')
  .action(async (file: string, options: any) => {
    try {
      console.log('\n' + '='.repeat(70));
      console.log('🌊 АНАЛИЗ ПОТОКА ДАННЫХ');
      console.log('='.repeat(70));
      console.log(`📄 Файл: ${file}`);

      // ✅ ПРОВЕРКА СУЩЕСТВОВАНИЯ ФАЙЛА
      const absolutePath = validateFileExists(file);

      const project = new Project({
        compilerOptions: {
          target: 99,
          module: 99,
          allowJs: true,
          checkJs: false,
          skipLibCheck: true,
        },
      });

      const sourceFile = project.addSourceFileAtPath(absolutePath);
      const analyzer = new DataFlowAnalyzer();
      const dataFlow = analyzer.analyze(sourceFile);

      if (options.json) {
        const jsonData = exportDataFlowToJSON(dataFlow);
        console.log(JSON.stringify(jsonData, null, 2));
      } else if (options.dot) {
        console.log(generateDotFromDataFlow(dataFlow));
      } else {
        printDataFlowReport(dataFlow, absolutePath);
      }

      if (options.output) {
        const outputPath = path.resolve(options.output);
        const ext = path.extname(outputPath);
        let content: string;

        if (ext === '.json') {
          content = JSON.stringify(exportDataFlowToJSON(dataFlow), null, 2);
        } else if (ext === '.dot') {
          content = generateDotFromDataFlow(dataFlow);
        } else {
          content = generateDataFlowMarkdown(dataFlow, absolutePath);
        }

        fs.writeFileSync(outputPath, content);
        console.log(`\n📄 Сохранено: ${outputPath}`);
      }

      exitWithCode(0);
    } catch (error) {
      console.error('❌ Ошибка при анализе потока данных:', error);
      exitWithCode(1);
    }
  });

// ============================================
// КОМАНДА: verify — формальная верификация
// ============================================

program
  .command('verify <file>')
  .description('Формальная верификация функции через Z3')
  .option('-f, --function <name>', 'Имя функции для верификации')
  .option('-c, --contract <file>', 'Файл с контрактом (JSON)')
  .option('-o, --output <file>', 'Сохранить результат')
  .action(async (file: string, options: any) => {
    try {
      console.log('\n' + '='.repeat(70));
      console.log('🔬 ФОРМАЛЬНАЯ ВЕРИФИКАЦИЯ');
      console.log('='.repeat(70));
      console.log(`📄 Файл: ${file}`);

      // ✅ ПРОВЕРКА СУЩЕСТВОВАНИЯ ФАЙЛА
      const absolutePath = validateFileExists(file);

      const z3 = new Z3Verifier();
      await z3.initialize();

      let contract: FunctionContract | null = null;

      if (options.contract) {
        const contractPath = path.resolve(options.contract);
        if (!fs.existsSync(contractPath)) {
          console.error(`❌ Контракт не найден: ${contractPath}`);
          exitWithCode(1);
        }
        contract = JSON.parse(fs.readFileSync(contractPath, 'utf-8'));
        console.log(`📋 Контракт загружен из: ${contractPath}`);
      } else if (options.function) {
        contract = await extractContractFromFile(absolutePath, options.function);
        if (!contract) {
          console.error(`❌ Функция '${options.function}' не найдена в файле`);
          exitWithCode(1);
        }
        console.log(`📋 Контракт извлечён из функции: ${options.function}`);
      } else {
        console.error('❌ Укажите --function <name> или --contract <file>');
        exitWithCode(1);
      }

      if (!contract) {
        console.error('❌ Контракт не загружен');
        exitWithCode(1);
      }

      console.log('\n📋 КОНТРАКТ:');
      console.log(`   Функция: ${contract.name}`);
      console.log(`   Параметры: ${contract.params.map(p => `${p.name}:${p.type}`).join(', ')}`);
      console.log(`   Возврат: ${contract.returnType}`);
      console.log(`   Предусловий: ${contract.preconditions.length}`);
      console.log(`   Постусловий: ${contract.postconditions.length}`);
      console.log(`   Инвариантов: ${contract.invariants.length}`);

      console.log('\n⏳ Верификация...');
      const result = await z3.verifyFunction(contract);

      if (result.isValid) {
        console.log('\n✅ ФУНКЦИЯ ВЕРИФИЦИРОВАНА!');
        console.log(`   ${contract.name} удовлетворяет всем контрактам`);
      } else {
        console.log('\n❌ ФУНКЦИЯ НЕ ВЕРИФИЦИРОВАНА!');
        if (result.counterexample) {
          console.log('\n🔍 Контрпример:');
          for (const [key, value] of result.counterexample) {
            console.log(`   ${key} = ${value}`);
          }
        }
        if (result.error) {
          console.log(`\n⚠️ Ошибка: ${result.error}`);
        }
      }

      console.log(`\n⏱️ Время: ${result.time}ms`);

      if (options.output) {
        const outputPath = path.resolve(options.output);
        const report = {
          contract,
          result: {
            isValid: result.isValid,
            counterexample: result.counterexample
              ? Object.fromEntries(result.counterexample)
              : null,
            error: result.error,
            time: result.time,
          },
          timestamp: new Date().toISOString(),
        };
        fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
        console.log(`\n📄 Результат сохранён: ${outputPath}`);
      }

      await z3.dispose();
      exitWithCode(result.isValid ? 0 : 1);
    } catch (error) {
      console.error('❌ Ошибка при формальной верификации:', error);
      exitWithCode(1);
    }
  });

// ============================================
// КОМАНДА: dead — поиск мёртвого кода
// ============================================

program
  .command('dead <paths...>')
  .description('Поиск неиспользуемого кода (dead code)')
  .option('-r, --recursive', 'Рекурсивный поиск', true)
  .option('--json', 'Вывод в JSON формате', false)
  .option('-o, --output <file>', 'Сохранить отчёт')
  .action(async (paths: string[], options: any) => {
    try {
      console.log('\n' + '='.repeat(70));
      console.log('🗑️ ПОИСК МЁРТВОГО КОДА');
      console.log('='.repeat(70));

      const files = await collectFiles(paths, options.recursive);

      if (files.length === 0) {
        console.error('❌ Не найдено файлов для анализа');
        exitWithCode(1);
      }

      console.log(`📁 Найдено файлов: ${files.length}`);
      console.log('');

      const allIssues: any[] = [];

      for (const file of files) {
        console.log(`📄 Анализ: ${path.basename(file)}`);

        try {
          const project = new Project({
            compilerOptions: {
              target: 99,
              module: 99,
              allowJs: true,
              checkJs: false,
              skipLibCheck: true,
            },
          });

          const sourceFile = project.addSourceFileAtPath(file);
          const analyzer = new DataFlowAnalyzer();
          const dataFlow = analyzer.analyze(sourceFile);

          const unusedVars = dataFlow.findUnusedVariables().filter((v: any) => {
            const isExported = sourceFile.getVariableDeclaration(v.name)?.isExported() || false;
            return !isExported && !v.name?.startsWith('_');
          });

          const allUnusedFunctions = findUnusedFunctions(sourceFile);
          const unusedFunctions = allUnusedFunctions.filter((f: any) => {
            const name = f.getName();
            return !f.isExported() && !name?.startsWith('_');
          });

          if (unusedVars.length > 0 || unusedFunctions.length > 0) {
            allIssues.push({
              file,
              unusedFunctions: unusedFunctions.map((f: any) => ({
                name: f.getName() || 'anonymous',
                line: f.getStartLineNumber(),
              })),
              unusedVariables: unusedVars.map((v: any) => ({
                name: v.name,
                line: v.line,
              })),
            });

            if (unusedFunctions.length > 0) {
              console.log(
                `   ⚠️ Неиспользуемые функции: ${unusedFunctions.map((f: any) => f.getName()).join(', ')}`
              );
            }
            if (unusedVars.length > 0) {
              console.log(
                `   ⚠️ Неиспользуемые переменные: ${unusedVars.map((v: any) => v.name).join(', ')}`
              );
            }
          } else {
            console.log('   ✅ Мёртвый код не найден');
          }
        } catch (error: any) {
          console.error(`   ❌ Ошибка анализа: ${error.message}`);
        }
      }

      if (options.json) {
        console.log(JSON.stringify(allIssues, null, 2));
      }

      if (options.output) {
        const outputPath = path.resolve(options.output);
        const ext = path.extname(outputPath);
        let content: string;

        if (ext === '.json') {
          content = JSON.stringify(allIssues, null, 2);
        } else {
          content = generateDeadCodeReport(allIssues);
        }

        fs.writeFileSync(outputPath, content);
        console.log(`\n📄 Отчёт сохранён: ${outputPath}`);
      }

      const totalIssues = allIssues.reduce(
        (sum: number, f: any) => sum + f.unusedFunctions.length + f.unusedVariables.length,
        0
      );

      console.log(`\n📊 ИТОГО: ${totalIssues} проблем в ${allIssues.length} файлах`);

      if (totalIssues > 0) {
        console.log('❌ Найден мертвый код');
        exitWithCode(1);
      } else {
        console.log('✅ Мертвый код не найден');
        exitWithCode(0);
      }
    } catch (error) {
      console.error('❌ Ошибка при поиске мёртвого кода:', error);
      exitWithCode(1);
    }
  });

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

async function collectFiles(paths: string[], recursive: boolean): Promise<string[]> {
  const files: string[] = [];
  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

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
        ],
        absolute: true,
      });
      files.push(...matched);
    }
  }

  return [...new Set(files)];
}

function findUnusedFunctions(sourceFile: any): any[] {
  const functions = sourceFile.getFunctions();
  const used = new Set<string>();
  const text = sourceFile.getText();

  for (const func of functions) {
    const name = func.getName();
    if (!name) continue;
    if (func.isExported()) continue;
    if (name.startsWith('_')) continue;

    const regex = new RegExp(`\\b${name}\\s*\\(`, 'g');
    let isUsed = false;

    const matches = text.match(regex);
    if (matches) {
      for (const match of matches) {
        const pos = text.indexOf(match);
        const before = text.substring(Math.max(0, pos - 20), pos);
        if (!before.includes('function') && !before.includes('=>')) {
          isUsed = true;
          break;
        }
      }
    }

    if (!isUsed) {
      used.add(name);
    }
  }

  return functions.filter((f: any) => {
    const name = f.getName();
    return name && used.has(name) && !f.isExported();
  });
}

async function extractContractFromFile(
  filePath: string,
  functionName: string
): Promise<FunctionContract | null> {
  const project = new Project({
    compilerOptions: {
      target: 99,
      module: 99,
      allowJs: true,
      checkJs: false,
      skipLibCheck: true,
    },
  });

  const sourceFile = project.addSourceFileAtPath(filePath);
  const func = sourceFile.getFunction(functionName);

  if (!func) return null;

  const params = func.getParameters().map((p: any) => ({
    name: p.getName(),
    type: 'int' as const,
  }));

  const returnType = func.getReturnType();
  let retType: 'int' | 'bool' | 'string' | 'void' = 'void';
  if (returnType.isNumber()) retType = 'int';
  else if (returnType.isBoolean()) retType = 'bool';
  else if (returnType.isString()) retType = 'string';

  return {
    name: functionName,
    params,
    returnType: retType,
    preconditions: [],
    postconditions: [],
    invariants: [],
  };
}

// ============================================
// ФУНКЦИИ ДЛЯ ВЫВОДА ОТЧЁТОВ
// ============================================

function printAnalysisReport(result: PipelineResult): void {
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

  if (errors.length > 0) {
    console.log('\n🔴 ОШИБКИ (первые 5):');
    for (const error of errors.slice(0, 5)) {
      console.log(`   • ${path.basename(error.file)}:${error.line} - ${error.message}`);
      if (error.suggestion) {
        console.log(`     💡 ${error.suggestion}`);
      }
    }
    if (errors.length > 5) {
      console.log(`   ... и ещё ${errors.length - 5} ошибок`);
    }
  }

  if (warnings.length > 0 && result.success) {
    console.log('\n🟡 ПРЕДУПРЕЖДЕНИЯ (первые 5):');
    for (const warning of warnings.slice(0, 5)) {
      console.log(`   • ${path.basename(warning.file)}:${warning.line} - ${warning.message}`);
    }
    if (warnings.length > 5) {
      console.log(`   ... и ещё ${warnings.length - 5} предупреждений`);
    }
  }

  if (result.verificationResults.length > 0) {
    const verified = result.verificationResults.filter((r: any) => r.isValid);
    const failed = result.verificationResults.filter((r: any) => !r.isValid);
    console.log('\n🔬 ФОРМАЛЬНАЯ ВЕРИФИКАЦИЯ:');
    console.log(`   • Верифицировано: ${verified.length}`);
    console.log(`   • Не верифицировано: ${failed.length}`);

    if (failed.length > 0) {
      console.log('\n   НЕ ВЕРИФИЦИРОВАНЫ:');
      for (const fail of failed.slice(0, 5)) {
        console.log(`   • ${(fail as any).functionName || 'unknown'}`);
        if (fail.counterexample) {
          console.log(
            `     Контрпример: ${JSON.stringify(Object.fromEntries(fail.counterexample))}`
          );
        }
      }
    }
  }

  console.log('\n' + '='.repeat(70));
}

function printCallGraphReport(callGraph: CallGraph, filePath: string): void {
  console.log('\n📊 ГРАФ ВЫЗОВОВ');
  console.log('='.repeat(70));
  console.log(`📄 Файл: ${path.basename(filePath)}`);
  console.log(`📊 Всего узлов: ${callGraph.nodes.size}`);
  console.log(`📊 Всего рёбер: ${callGraph.edges.length}`);
  console.log(
    `🎯 Точки входа: ${callGraph.entryPoints.map((n: any) => n.name).join(', ') || 'нет'}`
  );
  console.log(`🔄 Циклов: ${callGraph.cycles.length}`);

  const unused = callGraph.findUnusedFunctions();
  if (unused.length > 0) {
    console.log(`\n⚠️ Неиспользуемые функции: ${unused.map((n: any) => n.name).join(', ')}`);
  }

  if (callGraph.cycles.length > 0) {
    console.log(`\n🔄 Циклические зависимости:`);
    for (const cycle of callGraph.cycles.slice(0, 5)) {
      console.log(`   ${cycle.map((e: any) => `${e.from} → ${e.to}`).join(' → ')}`);
    }
  }

  console.log('\n📋 Узлы (первые 10):');
  let count = 0;
  for (const [name, node] of callGraph.nodes) {
    if (count >= 10) break;
    const calls = node.calls.map((c: any) => c.name).join(', ');
    console.log(`   • ${name}${node.isEntry ? ' 🎯' : ''}${node.isExported ? ' 📤' : ''}`);
    if (calls) {
      console.log(`     → ${calls}`);
    }
    count++;
  }
  if (callGraph.nodes.size > 10) {
    console.log(`   ... и ещё ${callGraph.nodes.size - 10} узлов`);
  }
}

function printCFGReport(cfg: ControlFlowGraph, filePath: string): void {
  console.log('\n📊 ГРАФ ПОТОКА УПРАВЛЕНИЯ');
  console.log('='.repeat(70));
  console.log(`📄 Файл: ${path.basename(filePath)}`);
  console.log(`📊 Базовых блоков: ${cfg.blocks.length}`);

  const unreachable = cfg.findUnreachableBlocks();
  console.log(`📍 Недостижимых блоков: ${unreachable.length}`);

  const loops = cfg.findLoops();
  console.log(`🔄 Циклов: ${loops.length}`);

  if (unreachable.length > 0) {
    console.log('\n⚠️ Недостижимые блоки:');
    for (const block of unreachable.slice(0, 5)) {
      const firstInst = block.instructions[0];
      const line = firstInst ? firstInst.getStartLineNumber() : '?';
      console.log(`   • Блок ${block.id} (строка ${line})`);
    }
    if (unreachable.length > 5) {
      console.log(`   ... и ещё ${unreachable.length - 5} блоков`);
    }
  }

  if (loops.length > 0) {
    console.log('\n🔄 Циклы:');
    for (const loop of loops.slice(0, 5)) {
      console.log(`   • Блок ${loop.header.id} (тело: ${loop.body.length} блоков)`);
    }
  }
}

function printTypeReport(result: TypeAnalysisResult, filePath: string): void {
  console.log('\n📊 АНАЛИЗ ТИПОВ');
  console.log('='.repeat(70));
  console.log(`📄 Файл: ${path.basename(filePath)}`);

  const errors = result.findTypeErrors();
  console.log(`❌ Ошибок типов: ${errors.length}`);

  if (errors.length > 0) {
    console.log('\n❌ ОШИБКИ ТИПОВ (первые 10):');
    for (const error of errors.slice(0, 10)) {
      console.log(`   • строка ${error.location.line}: ${error.message}`);
      console.log(`     Ожидалось: ${error.expected}, Получено: ${error.actual}`);
    }
    if (errors.length > 10) {
      console.log(`   ... и ещё ${errors.length - 10} ошибок`);
    }
  } else {
    console.log('\n✅ Ошибок типов не найдено');
  }
}

function printDataFlowReport(dataFlow: DataFlowGraph, filePath: string): void {
  console.log('\n📊 ПОТОК ДАННЫХ');
  console.log('='.repeat(70));
  console.log(`📄 Файл: ${path.basename(filePath)}`);
  console.log(`📊 Узлов: ${dataFlow.nodes.length}`);
  console.log(`📊 Рёбер: ${dataFlow.edges.length}`);

  const stats = dataFlow.getVariableStats();
  console.log('\n📊 СТАТИСТИКА ПЕРЕМЕННЫХ:');
  console.log(`   • Всего: ${stats.total}`);
  console.log(`   • Используется: ${stats.used}`);
  console.log(`   • Не используется: ${stats.unused}`);
  console.log(`   • Констант: ${stats.constants}`);
  console.log(`   • Переопределённых констант: ${stats.reassignedConstants}`);

  const unused = dataFlow.findUnusedVariables();
  if (unused.length > 0) {
    console.log(`\n⚠️ Неиспользуемые переменные: ${unused.map((v: any) => v.name).join(', ')}`);
  }

  const reassigned = dataFlow.findReassignedConstants();
  if (reassigned.length > 0) {
    console.log(
      `\n⚠️ Переопределённые константы: ${reassigned.map((v: any) => v.name).join(', ')}`
    );
  }
}

// ============================================
// ФУНКЦИИ ДЛЯ ГЕНЕРАЦИИ ОТЧЁТОВ В РАЗНЫХ ФОРМАТАХ
// ============================================

function generateDotFromCallGraph(callGraph: CallGraph): string {
  let dot = 'digraph CallGraph {\n';
  dot += '  rankdir=LR;\n';
  dot += '  node [shape=box, style="filled,rounded", fillcolor="#f3f4f6"];\n';
  dot += '  edge [color="#9ca3af", arrowhead=vee];\n\n';

  for (const [name, node] of callGraph.nodes) {
    const color = node.isEntry ? '#4f46e5' : '#f3f4f6';
    const fontColor = node.isEntry ? '#ffffff' : '#1f2937';
    const label = node.isEntry ? `⭐ ${name}` : name;
    dot += `  "${name}" [fillcolor="${color}", fontcolor="${fontColor}", label="${label}"];\n`;
  }

  for (const edge of callGraph.edges) {
    dot += `  "${edge.from}" -> "${edge.to}";\n`;
  }

  dot += '}\n';
  return dot;
}

function generateDotFromCFG(cfg: ControlFlowGraph): string {
  let dot = 'digraph CFG {\n';
  dot += '  rankdir=TB;\n';
  dot += '  node [shape=box, style="filled,rounded", fillcolor="#f3f4f6"];\n';
  dot += '  edge [color="#9ca3af", arrowhead=vee];\n\n';

  for (const block of cfg.blocks) {
    const color = block.isEntry ? '#4f46e5' : block.isExit ? '#ef4444' : '#f3f4f6';
    const fontColor = block.isEntry || block.isExit ? '#ffffff' : '#1f2937';
    const label = `${block.id}\\n${block.instructions.length} instr${block.isReachable ? '' : '\\n⚠️ недостижим'}`;
    dot += `  "${block.id}" [fillcolor="${color}", fontcolor="${fontColor}", label="${label}"];\n`;
  }

  for (const block of cfg.blocks) {
    for (const succ of block.successors) {
      dot += `  "${block.id}" -> "${succ.id}";\n`;
    }
  }

  dot += '}\n';
  return dot;
}

function generateDotFromDataFlow(dataFlow: DataFlowGraph): string {
  let dot = 'digraph DataFlow {\n';
  dot += '  rankdir=LR;\n';
  dot += '  node [shape=box, style="filled,rounded", fillcolor="#f3f4f6"];\n';
  dot += '  edge [color="#9ca3af", arrowhead=vee];\n\n';

  for (const node of dataFlow.nodes) {
    const color = node.isConst ? '#a5f3fc' : '#fde68a';
    const label = `${node.name}:${node.line}`;
    dot += `  "${node.id}" [fillcolor="${color}", label="${label}"];\n`;
  }

  for (const edge of dataFlow.edges) {
    const color = edge.type === 'definition' ? '#22c55e' : '#f59e0b';
    const style = edge.type === 'definition' ? 'solid' : 'dashed';
    dot += `  "${edge.from.id}" -> "${edge.to.id}" [color="${color}", style="${style}"];\n`;
  }

  dot += '}\n';
  return dot;
}

function exportCFGToJSON(cfg: ControlFlowGraph): any {
  return {
    blocks: cfg.blocks.map(b => ({
      id: b.id,
      isEntry: b.isEntry,
      isExit: b.isExit,
      isReachable: b.isReachable,
      instructions: b.instructions.map(i => i.getText()),
      successors: b.successors.map(s => s.id),
      predecessors: b.predecessors.map(p => p.id),
    })),
    unreachable: cfg.findUnreachableBlocks().map(b => b.id),
    loops: cfg.findLoops().map(l => ({
      header: l.header.id,
      body: l.body.map(b => b.id),
    })),
  };
}

function exportTypeAnalysisToJSON(result: TypeAnalysisResult): any {
  return {
    errors: result.findTypeErrors().map((e: any) => ({
      message: e.message,
      expected: e.expected,
      actual: e.actual,
      location: e.location,
    })),
  };
}

function exportDataFlowToJSON(dataFlow: DataFlowGraph): any {
  return {
    nodes: dataFlow.nodes.map((n: any) => ({
      id: n.id,
      name: n.name,
      type: n.type,
      line: n.line,
      isConst: n.isConst,
      value: n.value,
    })),
    edges: dataFlow.edges.map((e: any) => ({
      from: e.from.id,
      to: e.to.id,
      type: e.type,
    })),
    stats: dataFlow.getVariableStats(),
    unusedVariables: dataFlow.findUnusedVariables().map((v: any) => v.name),
    reassignedConstants: dataFlow.findReassignedConstants().map((v: any) => v.name),
  };
}

function generateCallGraphMarkdown(callGraph: CallGraph, filePath: string): string {
  let md = '# 🕸️ Call Graph Analysis\n\n';
  md += `**File:** \`${filePath}\`\n\n`;
  md += `**Nodes:** ${callGraph.nodes.size}\n`;
  md += `**Edges:** ${callGraph.edges.length}\n`;
  md += `**Entry points:** ${callGraph.entryPoints.map((n: any) => n.name).join(', ') || 'none'}\n`;
  md += `**Cycles:** ${callGraph.cycles.length}\n\n`;

  const unused = callGraph.findUnusedFunctions();
  if (unused.length > 0) {
    md += '## ⚠️ Unused Functions\n\n';
    for (const func of unused) {
      md += `- \`${func.name}\` (${path.basename(func.file)}:${func.line})\n`;
    }
    md += '\n';
  }

  if (callGraph.cycles.length > 0) {
    md += '## 🔄 Cyclic Dependencies\n\n';
    for (const cycle of callGraph.cycles) {
      md += `- ${cycle.map((e: any) => `${e.from} → ${e.to}`).join(' → ')}\n`;
    }
    md += '\n';
  }

  md += '## 📋 Nodes\n\n';
  md += '| Name | Entry | Exported | Calls |\n';
  md += '|------|-------|----------|-------|\n';
  for (const [name, node] of callGraph.nodes) {
    const calls = node.calls.map((c: any) => c.name).join(', ');
    md += `| \`${name}\` | ${node.isEntry ? '✅' : '❌'} | ${node.isExported ? '✅' : '❌'} | ${calls || '-'} |\n`;
  }

  return md;
}

function generateCFGMarkdown(cfg: ControlFlowGraph, filePath: string): string {
  let md = '# 🔀 Control Flow Graph\n\n';
  md += `**File:** \`${filePath}\`\n\n`;
  md += `**Blocks:** ${cfg.blocks.length}\n`;
  md += `**Unreachable:** ${cfg.findUnreachableBlocks().length}\n`;
  md += `**Loops:** ${cfg.findLoops().length}\n\n`;

  const unreachable = cfg.findUnreachableBlocks();
  if (unreachable.length > 0) {
    md += '## ⚠️ Unreachable Blocks\n\n';
    for (const block of unreachable) {
      const firstInst = block.instructions[0];
      const line = firstInst ? firstInst.getStartLineNumber() : '?';
      md += `- \`${block.id}\` (line ${line})\n`;
    }
    md += '\n';
  }

  if (cfg.findLoops().length > 0) {
    md += '## 🔄 Loops\n\n';
    for (const loop of cfg.findLoops()) {
      md += `- **Header:** \`${loop.header.id}\`, **Body:** ${loop.body.length} blocks\n`;
    }
    md += '\n';
  }

  md += '## 📋 Blocks\n\n';
  md += '| ID | Entry | Exit | Reachable | Instructions |\n';
  md += '|----|-------|------|-----------|--------------|\n';
  for (const block of cfg.blocks) {
    const instr = block.instructions.length;
    md += `| \`${block.id}\` | ${block.isEntry ? '✅' : '❌'} | ${block.isExit ? '✅' : '❌'} | ${block.isReachable ? '✅' : '❌'} | ${instr} |\n`;
  }

  return md;
}

function generateTypeMarkdown(result: TypeAnalysisResult, filePath: string): string {
  let md = '# 📝 Type Analysis\n\n';
  md += `**File:** \`${filePath}\`\n\n`;

  const errors = result.findTypeErrors();
  md += `**Type Errors:** ${errors.length}\n\n`;

  if (errors.length > 0) {
    md += '## ❌ Type Errors\n\n';
    md += '| Line | Message | Expected | Actual |\n';
    md += '|------|---------|----------|--------|\n';
    for (const error of errors) {
      md += `| ${error.location.line} | ${error.message} | \`${error.expected}\` | \`${error.actual}\` |\n`;
    }
  } else {
    md += '✅ No type errors found\n';
  }

  return md;
}

function generateDataFlowMarkdown(dataFlow: DataFlowGraph, filePath: string): string {
  let md = '# 🌊 Data Flow Analysis\n\n';
  md += `**File:** \`${filePath}\`\n\n`;

  const stats = dataFlow.getVariableStats();
  md += '## 📊 Statistics\n\n';
  md += '| Metric | Value |\n';
  md += '|--------|-------|\n';
  md += `| Total variables | ${stats.total} |\n`;
  md += `| Used variables | ${stats.used} |\n`;
  md += `| Unused variables | ${stats.unused} |\n`;
  md += `| Constants | ${stats.constants} |\n`;
  md += `| Reassigned constants | ${stats.reassignedConstants} |\n\n`;

  const unused = dataFlow.findUnusedVariables();
  if (unused.length > 0) {
    md += '## ⚠️ Unused Variables\n\n';
    for (const v of unused) {
      md += `- \`${v.name}\` (line ${v.line})\n`;
    }
    md += '\n';
  }

  const reassigned = dataFlow.findReassignedConstants();
  if (reassigned.length > 0) {
    md += '## ⚠️ Reassigned Constants\n\n';
    for (const v of reassigned) {
      md += `- \`${v.name}\` (line ${v.line})\n`;
    }
    md += '\n';
  }

  return md;
}

function generateDeadCodeReport(issues: any[]): string {
  let md = '# 🗑️ Dead Code Report\n\n';
  md += `**Generated:** ${new Date().toLocaleString()}\n\n`;

  const totalIssues = issues.reduce(
    (sum: number, f: any) => sum + f.unusedFunctions.length + f.unusedVariables.length,
    0
  );
  md += `**Total Issues:** ${totalIssues} in ${issues.length} files\n\n`;

  for (const issue of issues) {
    md += `## 📄 ${path.basename(issue.file)}\n\n`;

    if (issue.unusedFunctions.length > 0) {
      md += '### ⚠️ Unused Functions\n\n';
      for (const func of issue.unusedFunctions) {
        md += `- \`${func.name}\` (line ${func.line})\n`;
      }
      md += '\n';
    }

    if (issue.unusedVariables.length > 0) {
      md += '### ⚠️ Unused Variables\n\n';
      for (const v of issue.unusedVariables) {
        md += `- \`${v.name}\` (line ${v.line})\n`;
      }
      md += '\n';
    }
  }

  return md;
}

// ============================================
// ЗАПУСК CLI
// ============================================

// Запускаем программу только если мы не в тестовой среде
// или если файл запущен напрямую (не импортирован)
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
const isTestEnv = process.env.NODE_ENV === 'test';

if (isMainModule && !isTestEnv) {
  program.parse();
}

export { program };
