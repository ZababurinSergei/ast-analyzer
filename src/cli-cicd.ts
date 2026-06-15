#!/usr/bin/env node

/**
 * CLI для CI/CD проверки TypeScript и автоматического исправления
 *
 * Использование:
 *   npx ast-cicd ts-check <paths...> [options]
 *   npx ast-cicd ts-fix <paths...> [options]
 *   npx ast-cicd pipeline <paths...> [options]
 *   npx ast-cicd eslint <paths...> [options]
 *   npx ast-cicd eslint-init
 *   npx ast-cicd status
 */

import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import readline from 'readline';
import { CICPipeline, AutoTypeScriptFixer } from './ci-cd/index.js';
import { TypeScriptValidator } from './refactor/TypeScriptValidator.js';
import { ESLintPipeline } from './ci-cd/ESLintPipeline.js';

// Тип для результата проверки TypeScript
export interface CIResult {
  success: boolean;
  summary: {
    totalErrors: number;
    totalWarnings: number;
    totalFixes: number;
  };
  errors: { file: string; line: number; message: string }[];
  warnings: { file: string; line: number; message: string }[];
  fixes: { file: string; line: number; message: string }[];
}

const program = new Command();

program
  .name('ast-cicd')
  .description('🚀 CI/CD инструменты для проверки и исправления кода')
  .version('1.0.0');

/**
 * Команда: ts-check - проверка TypeScript
 */
program
  .command('ts-check <paths...>')
  .description('Проверка TypeScript ошибок')
  .option('-r, --recursive', 'Рекурсивный поиск файлов', false)
  .option('-o, --output <file>', 'Сохранить отчёт', './ts-report.md')
  .option('-j, --json', 'Вывод в JSON формате', false)
  .option('--jsx', 'Включить анализ JSX/TSX', true)
  .action(async (paths: string[], options: any) => {
    console.log('\n🔍 ПРОВЕРКА TYPESCRIPT ОШИБОК');
    console.log('='.repeat(60));

    const files = await collectFiles(paths, options.recursive, true);

    if (files.length === 0) {
      console.error('❌ Не найдено TypeScript файлов для проверки');
      process.exit(1);
    }

    console.log(`📁 Найдено файлов: ${files.length}\n`);
    console.log(`⚛️ Анализ JSX/TSX: ${options.jsx ? 'включен' : 'выключен'}\n`);

    const validator = new TypeScriptValidator();
    const result = await validator.validateFiles(files);

    // JSX статистика если есть
    const jsxFiles = files.filter(f => f.endsWith('.tsx') || f.endsWith('.jsx'));
    if (jsxFiles.length > 0 && options.jsx) {
      console.log(`⚛️ JSX/TSX файлов: ${jsxFiles.length}`);
    }

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      const cicd = new CICPipeline();
      const report = cicd.generateCIReport(result as any, 'markdown');

      // Сохраняем отчёт
      const outputPath = path.resolve(options.output);
      const reportDir = path.dirname(outputPath);
      if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
      }
      await fs.promises.writeFile(outputPath, report, 'utf-8');
      console.log(report);
      console.log(`\n📄 Отчёт сохранён: ${outputPath}`);
    }

    console.log('\n📊 ИТОГИ ПРОВЕРКИ:');
    console.log(`   ❌ Ошибок: ${result.summary.totalErrors}`);
    console.log(`   ⚠️ Предупреждений: ${result.summary.totalWarnings}`);
    console.log(`   🔧 Автоисправимых: ${result.summary.totalFixes}`);

    process.exit(result.success ? 0 : 1);
  });

/**
 * Команда: ts-fix - автоматическое исправление
 */
program
  .command('ts-fix <paths...>')
  .description('Автоматическое исправление TypeScript ошибок')
  .option('-r, --recursive', 'Рекурсивный поиск файлов', false)
  .option('--no-backup', 'Не создавать бэкапы', false)
  .option('-d, --dry-run', 'Пробный запуск без изменений', false)
  .action(async (paths: string[], options: any) => {
    console.log('\n🔧 АВТОМАТИЧЕСКОЕ ИСПРАВЛЕНИЕ TYPESCRIPT ОШИБОК');
    console.log('='.repeat(60));

    const files = await collectFiles(paths, options.recursive, true);

    if (files.length === 0) {
      console.error('❌ Не найдено TypeScript файлов для исправления');
      process.exit(1);
    }

    console.log(`📁 Найдено файлов: ${files.length}\n`);

    if (options.dryRun) {
      console.log('⚠️ РЕЖИМ DRY RUN: Исправления не будут применены\n');

      const validator = new TypeScriptValidator();
      const result = await validator.validateFiles(files);

      console.log('Проблемы, которые будут исправлены:');
      for (const fix of result.fixes) {
        console.log(`   📄 ${path.basename(fix.file)}:${fix.line} - ${fix.message}`);
      }

      console.log('\n💡 Для реального исправления запустите без флага --dry-run');
      process.exit(0);
    }

    const fixer = new AutoTypeScriptFixer();
    const result = await fixer.autoFixFiles(files, options.backup !== false);

    process.exit(result.success ? 0 : 1);
  });

/**
 * Команда: eslint - запуск ESLint
 */
program
  .command('eslint <paths...>')
  .description('Запуск ESLint с автоисправлением')
  .option('-r, --recursive', 'Рекурсивный поиск файлов', false)
  .option('--fix', 'Автоматическое исправление', true)
  .option('--no-fix', 'Только проверка без исправлений')
  .option('--init', 'Создать конфигурацию ESLint', false)
  .option('--config <file>', 'Путь к конфигурации ESLint', '.eslintrc.json')
  .action(async (paths: string[], options: any) => {
    console.log('\n📝 ESLint АНАЛИЗ');
    console.log('='.repeat(60));

    if (options.init) {
      console.log('🔧 Создание конфигурации ESLint...');
      const eslintPipeline = new ESLintPipeline();
      await eslintPipeline.generateConfig(process.cwd());
      console.log('✅ Конфигурация ESLint создана: .eslintrc.json');
      console.log(
        '💡 Установите зависимости: npm install -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin eslint-plugin-react'
      );
      return;
    }

    const files = await collectFiles(paths, options.recursive, true);

    if (files.length === 0) {
      console.error('❌ Не найдено файлов для анализа');
      process.exit(1);
    }

    const jsxFiles = files.filter(f => f.endsWith('.tsx') || f.endsWith('.jsx'));
    const jsFiles = files.filter(f => f.endsWith('.js') || f.endsWith('.jsx'));
    const tsFiles = files.filter(f => f.endsWith('.ts') || f.endsWith('.tsx'));

    console.log(`📁 Найдено файлов: ${files.length}`);
    console.log(`   📄 JS/JSX: ${jsFiles.length}`);
    console.log(`   📘 TS/TSX: ${tsFiles.length}`);
    console.log(`   ⚛️ JSX/TSX: ${jsxFiles.length}`);
    console.log(`🔧 Автоисправление: ${options.fix ? 'включено' : 'выключено'}\n`);

    const eslintPipeline = new ESLintPipeline({
      extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        jsxFiles.length > 0 ? 'plugin:react/recommended' : '',
        jsxFiles.length > 0 ? 'plugin:react-hooks/recommended' : '',
      ].filter(Boolean) as string[],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: jsxFiles.length > 0,
          tsx: jsxFiles.length > 0,
        },
      },
      settings:
        jsxFiles.length > 0
          ? {
              react: {
                version: 'detect',
              },
            }
          : undefined,
      rules: {
        'react/jsx-uses-react': 'off',
        'react/react-in-jsx-scope': 'off',
        '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
        '@typescript-eslint/no-explicit-any': 'warn',
      },
    });

    const results = await eslintPipeline.run(files, options.fix);

    const totalFixes = results.reduce((sum, r) => sum + r.fixCount, 0);
    const fixedFiles = results.filter(r => r.fixed).length;

    console.log('\n📊 РЕЗУЛЬТАТЫ:');
    console.log(`   ✅ Исправлено файлов: ${fixedFiles}/${results.length}`);
    console.log(`   🔧 Всего исправлений: ${totalFixes}`);

    const filesWithIssues = results.filter(r => r.messages.length > 0 && !r.fixed);
    if (filesWithIssues.length > 0) {
      console.log('\n⚠️ Файлы с оставшимися проблемами:');
      for (const file of filesWithIssues.slice(0, 10)) {
        const errors = file.messages.filter(m => m.severity === 2).length;
        const warnings = file.messages.filter(m => m.severity === 1).length;
        console.log(`   📄 ${path.basename(file.file)}: ${errors} errors, ${warnings} warnings`);
      }
      if (filesWithIssues.length > 10) {
        console.log(`   ... и ещё ${filesWithIssues.length - 10} файлов`);
      }
      process.exit(1);
    } else {
      console.log('\n✨ ESLint проверка пройдена успешно!');
    }
  });

/**
 * Команда: eslint-init - создание конфигурации ESLint
 */
program
  .command('eslint-init')
  .description('Создать конфигурацию ESLint для проекта')
  .action(async () => {
    console.log('\n🔧 СОЗДАНИЕ КОНФИГУРАЦИИ ESLINT');
    console.log('='.repeat(60));

    const eslintPipeline = new ESLintPipeline();
    await eslintPipeline.generateConfig(process.cwd());

    console.log('\n✅ Конфигурация ESLint создана: .eslintrc.json');
    console.log('\n📦 Установите необходимые зависимости:');
    console.log(
      '   npm install -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin'
    );
    console.log('   npm install -D eslint-plugin-react eslint-plugin-react-hooks');
    console.log('\n💡 Добавьте скрипты в package.json:');
    console.log('   "lint": "eslint . --ext .js,.jsx,.ts,.tsx"');
    console.log('   "lint:fix": "eslint . --ext .js,.jsx,.ts,.tsx --fix"');
  });

/**
 * Команда: pipeline - полный CI/CD пайплайн
 */
program
  .command('pipeline <paths...>')
  .description('Запуск полного CI/CD пайплайна')
  .option('-r, --recursive', 'Рекурсивный поиск файлов', false)
  .option('--no-fix', 'Отключить автоисправление', false)
  .option('--no-backup', 'Не создавать бэкапы', false)
  .option('--eslint', 'Запустить ESLint', true)
  .option('--no-eslint', 'Отключить ESLint')
  .option('--eslint-fix', 'Автоисправление ESLint', true)
  .option('--jsx', 'Включить анализ JSX/TSX', true)
  .option('--formal', 'Включить формальную верификацию', false)
  .option('--tests', 'Запустить тесты', false)
  .action(async (paths: string[], options: any) => {
    console.log('\n🚀 ЗАПУСК CI/CD ПАЙПЛАЙНА');
    console.log('='.repeat(60));

    const files = await collectFiles(paths, options.recursive, true);

    if (files.length === 0) {
      console.error('❌ Не найдено файлов для обработки');
      process.exit(1);
    }

    const jsxFiles = files.filter(f => f.endsWith('.tsx') || f.endsWith('.jsx'));

    console.log(`📁 Найдено файлов: ${files.length}`);
    console.log(`   ⚛️ JSX/TSX файлов: ${jsxFiles.length}`);
    console.log(
      `🔧 Автоисправление TypeScript: ${options.fix !== false ? 'включено' : 'выключено'}`
    );
    console.log(`💾 Бэкапы: ${options.backup !== false ? 'включены' : 'выключены'}`);
    console.log(`📝 ESLint: ${options.eslint ? 'включён' : 'выключен'}`);
    console.log(`🔧 ESLint автофикс: ${options.eslintFix ? 'включён' : 'выключен'}`);
    console.log(`⚛️ JSX анализ: ${options.jsx ? 'включён' : 'выключен'}`);
    console.log(`🔬 Формальная верификация: ${options.formal ? 'включена' : 'выключена'}`);
    console.log(`🧪 Тесты: ${options.tests ? 'включены' : 'выключены'}\n`);

    const cicd = new CICPipeline();

    const result = await cicd.runFullPipeline(files, {
      semanticAnalysis: true,
      formalVerification: options.formal,
      typeCheck: true,
      codeValidation: true,
      autoFix: options.fix !== false,
      createBackup: options.backup !== false,
      eslintCheck: options.eslint,
      eslintFix: options.eslintFix,
      jsxAnalysis: options.jsx,
      generateReport: true,
      reportFormat: 'markdown',
    });

    // Генерация финального отчёта
    const validator = new TypeScriptValidator();
    const finalResult = await validator.validateFiles(files);
    const cicdInstance = new CICPipeline();
    const report = cicdInstance.generateCIReport(finalResult as any, 'markdown');
    const reportPath = path.resolve('./cicd-pipeline-report.md');
    await fs.promises.writeFile(reportPath, report, 'utf-8');
    console.log(`\n📄 Отчёт пайплайна: ${reportPath}`);

    // JSX статистика
    if (options.jsx && jsxFiles.length > 0) {
      console.log('\n⚛️ JSX/TSX Статистика:');
      console.log(`   📁 Файлов с JSX: ${jsxFiles.length}`);
      console.log(
        `   💡 Запустите "npx ast-cicd eslint ${paths.join(' ')} --fix" для проверки React правил`
      );
    }

    process.exit(result.success ? 0 : 1);
  });

/**
 * Команда: status - статус проекта
 */
program
  .command('status')
  .description('Показать общий статус проекта')
  .option('-p, --path <dir>', 'Путь к проекту', '.')
  .action(async (options: any) => {
    console.log('\n📊 СТАТУС ПРОЕКТА');
    console.log('='.repeat(60));

    const projectPath = path.resolve(options.path);
    console.log(`📁 Проект: ${projectPath}\n`);

    // Собираем все TypeScript файлы
    const allTsFiles = await glob('**/*.{ts,tsx}', {
      cwd: projectPath,
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/*.test.ts', '**/*.spec.ts'],
      absolute: true,
    });

    const allJsFiles = await glob('**/*.{js,jsx}', {
      cwd: projectPath,
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/*.test.js', '**/*.spec.js'],
      absolute: true,
    });

    const tsxFiles = allTsFiles.filter(f => f.endsWith('.tsx'));
    const jsxFiles = allJsFiles.filter(f => f.endsWith('.jsx'));

    console.log(`📄 TypeScript файлов: ${allTsFiles.length}`);
    console.log(`   📘 TSX файлов: ${tsxFiles.length}`);
    console.log(`📄 JavaScript файлов: ${allJsFiles.length}`);
    console.log(`   ⚛️ JSX файлов: ${jsxFiles.length}`);
    console.log(`   📦 Всего JSX/TSX: ${tsxFiles.length + jsxFiles.length}`);

    const validator = new TypeScriptValidator();
    const result = await validator.validateFiles([...allTsFiles, ...allJsFiles]);

    console.log('\n📊 СТАТИСТИКА:');
    console.log(`   ✅ Успешно: ${result.success ? 'ДА' : 'НЕТ'}`);
    console.log(`   ❌ Ошибок: ${result.summary.totalErrors}`);
    console.log(`   ⚠️ Предупреждений: ${result.summary.totalWarnings}`);
    console.log(`   🔧 Автоисправимых: ${result.summary.totalFixes}`);

    // Проверка наличия ESLint конфигурации
    const eslintConfigPath = path.join(projectPath, '.eslintrc.json');
    if (fs.existsSync(eslintConfigPath)) {
      console.log('\n📝 ESLint конфигурация: ✅ найдена');
    } else {
      console.log('\n📝 ESLint конфигурация: ❌ отсутствует');
      console.log('   💡 Создайте: npx ast-cicd eslint-init');
    }

    // Группировка ошибок по файлам
    const issuesByFile = new Map<string, number>();
    for (const issue of result.issues) {
      if (issue.type === 'error') {
        const count = issuesByFile.get(issue.file) || 0;
        issuesByFile.set(issue.file, count + 1);
      }
    }

    if (issuesByFile.size > 0) {
      console.log('\n📁 ОШИБКИ ПО ФАЙЛАМ:');
      const sorted = Array.from(issuesByFile.entries()).sort((a, b) => b[1] - a[1]);
      for (const [file, count] of sorted.slice(0, 10)) {
        const isJsx = file.endsWith('.tsx') || file.endsWith('.jsx');
        const icon = isJsx ? '⚛️' : '📄';
        console.log(`   ${icon} ${path.basename(file)}: ${count} ошибок`);
      }
      if (sorted.length > 10) {
        console.log(`   ... и ещё ${sorted.length - 10} файлов с ошибками`);
      }
    }

    if (!result.success) {
      console.log('\n💡 Рекомендации:');
      console.log('   1. Запустите автоисправление: npx ast-cicd ts-fix . -r');
      console.log('   2. Запустите ESLint: npx ast-cicd eslint . -r --fix');
      console.log('   3. Запустите полный пайплайн: npx ast-cicd pipeline . -r');
      console.log('   4. Просмотрите детальный отчёт: npx ast-cicd ts-check . -r -o report.md');
    } else {
      console.log('\n✨ ПРОЕКТ В ИДЕАЛЬНОМ СОСТОЯНИИ!');
      if (tsxFiles.length + jsxFiles.length > 0) {
        console.log(`   ⚛️ JSX/TSX компоненты: ${tsxFiles.length + jsxFiles.length}`);
        console.log('   💡 Не забудьте настроить ESLint для React');
      }
    }
  });

/**
 * Команда: init - инициализация конфигурации
 */
program
  .command('init')
  .description('Создать конфигурационный файл .ast-cicd.json')
  .action(async () => {
    const configPath = path.resolve(process.cwd(), '.ast-cicd.json');

    if (fs.existsSync(configPath)) {
      console.log('⚠️ Файл .ast-cicd.json уже существует');
      const answer = await askQuestion('Перезаписать? (y/N): ');
      if (answer.toLowerCase() !== 'y') {
        console.log('❌ Отменено');
        process.exit(0);
      }
    }

    const defaultConfig = {
      $schema: './node_modules/ast-analyzer/ci-cd-schema.json',
      version: '1.0.0',
      typescript: {
        strict: true,
        noImplicitAny: true,
        strictNullChecks: true,
        jsx: true,
      },
      jsxAnalysis: {
        enabled: true,
        checkPropTypes: true,
        detectUnusedComponents: true,
      },
      eslint: {
        enabled: true,
        config: '.eslintrc.json',
        autoFix: true,
        rules: {
          'react/jsx-uses-react': 'off',
          'react/react-in-jsx-scope': 'off',
        },
      },
      autoFix: {
        enabled: true,
        createBackup: true,
        maxIterations: 3,
      },
      ignore: {
        files: ['**/*.test.ts', '**/*.spec.ts', '**/dist/**', '**/build/**'],
        errors: [2307, 2304],
      },
      pipeline: {
        runOnSave: false,
        preCommit: true,
        generateReport: true,
      },
    };

    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
    console.log(`✅ Создан конфигурационный файл: ${configPath}`);
    console.log('📝 Отредактируйте его под свои нужды');

    // Создаем также ESLint конфигурацию если её нет
    const eslintConfigPath = path.resolve(process.cwd(), '.eslintrc.json');
    if (!fs.existsSync(eslintConfigPath)) {
      console.log('\n📝 Создание ESLint конфигурации...');
      const eslintPipeline = new ESLintPipeline();
      await eslintPipeline.generateConfig(process.cwd());
    }
  });

/**
 * Команда: jsx-analyze - анализ JSX/TSX файлов
 */
program
  .command('jsx-analyze <paths...>')
  .description('Анализ JSX/TSX компонентов')
  .option('-r, --recursive', 'Рекурсивный поиск файлов', false)
  .option('-o, --output <file>', 'Сохранить отчёт', './jsx-analysis.json')
  .action(async (paths: string[], options: any) => {
    console.log('\n⚛️ АНАЛИЗ JSX/TSX КОМПОНЕНТОВ');
    console.log('='.repeat(60));

    const files = await collectFiles(paths, options.recursive, true);
    const jsxFiles = files.filter(f => f.endsWith('.tsx') || f.endsWith('.jsx'));

    if (jsxFiles.length === 0) {
      console.error('❌ Не найдено JSX/TSX файлов для анализа');
      process.exit(1);
    }

    console.log(`📁 Найдено JSX/TSX файлов: ${jsxFiles.length}\n`);

    const analysisResults: any[] = [];

    for (const file of jsxFiles) {
      console.log(`📄 Анализ: ${path.basename(file)}`);

      try {
        const { Project } = await import('ts-morph');
        const { JSXAnalyzer } = await import('./semantic/JSXAnalyzer.js');

        const project = new Project({
          compilerOptions: {
            target: 99,
            module: 99,
            allowJs: true,
            jsx: 2,
            skipLibCheck: true,
          },
        });

        const sourceFile = project.addSourceFileAtPath(file);
        const analyzer = new JSXAnalyzer(file);
        const analysis = analyzer.analyze(sourceFile);

        analysisResults.push({
          file,
          componentCount: analysis.componentProps.size,
          elementCount: analysis.elements.length,
          components: Array.from(analysis.componentProps.keys()),
          propErrors: analysis.propTypeErrors.length,
        });

        console.log(`   ⚛️ Компонентов: ${analysis.componentProps.size}`);
        console.log(`   🧩 Элементов: ${analysis.elements.length}`);
        if (analysis.componentProps.size > 0) {
          console.log(
            `   📦 Компоненты: ${Array.from(analysis.componentProps.keys()).slice(0, 5).join(', ')}`
          );
          if (analysis.componentProps.size > 5)
            console.log(`      ... и ещё ${analysis.componentProps.size - 5}`);
        }
      } catch (error: any) {
        console.error(`   ❌ Ошибка анализа: ${error.message}`);
        analysisResults.push({
          file,
          error: error.message,
        });
      }
    }

    // Сохраняем результаты
    const outputPath = path.resolve(options.output);
    fs.writeFileSync(outputPath, JSON.stringify(analysisResults, null, 2));

    console.log('\n📊 ИТОГИ АНАЛИЗА:');
    const totalComponents = analysisResults.reduce((sum, r) => sum + (r.componentCount || 0), 0);
    console.log(`   ⚛️ Всего компонентов: ${totalComponents}`);
    console.log(`   📄 Проанализировано файлов: ${analysisResults.length}`);
    console.log(`   ✅ Отчёт сохранён: ${outputPath}`);
  });

/**
 * Вспомогательная функция: сбор файлов
 */
async function collectFiles(
  paths: string[],
  recursive: boolean,
  includeJsx = true
): Promise<string[]> {
  const files: string[] = [];
  const extensions = includeJsx
    ? ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']
    : ['.ts', '.js', '.mjs', '.cjs'];

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
          '**/*.test.js',
          '**/*.spec.js',
        ],
        absolute: true,
      });

      files.push(...matched);
    }
  }

  return [...new Set(files)];
}

/**
 * Вспомогательная функция: вопрос пользователю
 */
function askQuestion(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => {
    rl.question(question, (answer: string) => {
      rl.close();
      resolve(answer);
    });
  });
}

// Запуск CLI
if (process.argv.length <= 2) {
  program.help();
}

program.parse();
