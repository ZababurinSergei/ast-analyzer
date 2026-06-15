#!/usr/bin/env node

/**
 * CLI для валидации и исправления кода
 *
 * Использование:
 *   npx ast-validator validate <paths...> [options]
 *   npx ast-validator fix <paths...> [options]
 *   npx ast-validator check-and-fix <paths...> [options]
 */

import { Command } from 'commander';
import { CodeValidator } from './CodeValidator.js';
import { CodeFixer } from './CodeFixer.js';
import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

const program = new Command();

program
  .name('ast-validator')
  .description('🔍 Валидация и исправление кода - проверка синтаксиса, импортов, экспортов, типов')
  .version('1.0.0');

/**
 * Команда: validate - только проверка
 */
program
  .command('validate <paths...>')
  .description('Проверить файлы на наличие проблем (синтаксис, импорты, экспорты, циклы)')
  .option('-r, --recursive', 'Рекурсивный поиск файлов в директориях', false)
  .option('-o, --output <file>', 'Сохранить отчёт в файл', './validation-report.md')
  .option('-j, --json', 'Вывод результатов в JSON формате', false)
  .option('--no-color', 'Отключить цветной вывод', false)
  .action(async (paths: string[], options: any) => {
    console.log('\n🔍 ЗАПУСК ВАЛИДАЦИИ КОДА');
    console.log('='.repeat(60));

    const files = await collectFiles(paths, options.recursive);

    if (files.length === 0) {
      console.error('❌ Не найдено файлов для проверки');
      console.error('   Укажите существующие файлы или директории с кодом');
      process.exit(1);
    }

    console.log(`📁 Найдено файлов для проверки: ${files.length}\n`);

    const validator = new CodeValidator();
    const result = await validator.validateFiles(files);

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      await validator.saveReport(result, options.output);
    }

    // Вывод сводки в консоль
    console.log('\n📊 ИТОГОВАЯ СВОДКА:');
    console.log(`   ❌ Ошибок: ${result.summary.errors}`);
    console.log(`   ⚠️  Предупреждений: ${result.summary.warnings}`);
    console.log(`   ℹ️  Замечаний: ${result.summary.info}`);
    console.log(`   🔧 Автоисправимых: ${result.summary.autoFixable}`);

    if (result.summary.errors > 0) {
      console.log('\n💡 Для автоматического исправления запустите:');
      console.log(`   npx ast-validator fix ${paths.join(' ')} ${options.recursive ? '-r' : ''}`);
      process.exit(1);
    } else {
      console.log('\n✅ ВАЛИДАЦИЯ ПРОЙДЕНА УСПЕШНО!');
    }
  });

/**
 * Команда: fix - автоматическое исправление
 */
program
  .command('fix <paths...>')
  .description('Автоматически исправить обнаруженные проблемы')
  .option('-r, --recursive', 'Рекурсивный поиск файлов в директориях', false)
  .option('--no-backup', 'Не создавать резервные копии файлов', false)
  .option('--dry-run', 'Пробный запуск без фактических изменений', false)
  .option(
    '--only <types>',
    'Исправлять только указанные типы проблем (syntax,imports,exports,vars)',
    ''
  )
  .action(async (paths: string[], options: any) => {
    console.log('\n🔧 ЗАПУСК АВТОМАТИЧЕСКОГО ИСПРАВЛЕНИЯ');
    console.log('='.repeat(60));

    const files = await collectFiles(paths, options.recursive);

    if (files.length === 0) {
      console.error('❌ Не найдено файлов для исправления');
      process.exit(1);
    }

    console.log(`📁 Найдено файлов: ${files.length}\n`);

    // Сначала проверяем, чтобы выявить проблемы
    const validator = new CodeValidator();
    const result = await validator.validateFiles(files);

    if (result.summary.autoFixable === 0) {
      console.log('✅ Нет проблем, требующих автоматического исправления');
      console.log(
        `   Всего проблем: ${result.summary.errors + result.summary.warnings + result.summary.info}`
      );
      console.log('   Из них автоисправимых: 0');
      return;
    }

    console.log(`📊 Найдено автоисправимых проблем: ${result.summary.autoFixable}\n`);

    // Фильтрация по типам, если указано
    let issuesToFix = result.issues;
    if (options.only) {
      const allowedTypes = options.only.split(',').map((t: string) => t.trim());
      issuesToFix = issuesToFix.filter((issue: any) => {
        if (allowedTypes.includes('syntax') && issue.message.includes('синтаксис')) return true;
        if (allowedTypes.includes('imports') && issue.message.includes('импорт')) return true;
        if (allowedTypes.includes('exports') && issue.message.includes('экспорт')) return true;
        if (allowedTypes.includes('vars') && issue.message.includes('переменная')) return true;
        return false;
      });
      console.log(`🎯 Фильтрация по типам: ${allowedTypes.join(', ')}`);
      console.log(`   Будет исправлено: ${issuesToFix.length} проблем\n`);
    }

    if (options.dryRun) {
      console.log('⚠️ РЕЖИМ DRY RUN: Исправления не будут применены\n');
      console.log('Проблемы, которые будут исправлены:');

      const byFile = new Map<string, number>();
      for (const issue of issuesToFix) {
        if (issue.autoFixable) {
          const count = byFile.get(issue.file) || 0;
          byFile.set(issue.file, count + 1);
        }
      }

      for (const [file, count] of byFile) {
        console.log(`   📄 ${path.basename(file)}: ${count} проблем`);
      }

      console.log('\n💡 Для реального исправления запустите без флага --dry-run');
      return;
    }

    // Исправляем
    const fixer = new CodeFixer();
    const fixResults = await fixer.autoFix(issuesToFix, options.backup);

    const successCount = fixResults.filter((r: any) => r.success).length;
    const totalFixes = fixResults.reduce((sum: number, r: any) => sum + r.fixes, 0);

    console.log('\n📊 ИТОГИ ИСПРАВЛЕНИЯ:');
    console.log(`   ✅ Успешно обработано: ${successCount}/${fixResults.length} файлов`);
    console.log(`   🔧 Исправлено проблем: ${totalFixes}`);
    console.log(`   💾 Бэкапы: ${options.backup ? 'созданы' : 'не созданы'}`);

    if (totalFixes > 0) {
      console.log('\n💡 Рекомендуется запустить повторную проверку:');
      console.log(
        `   npx ast-validator validate ${paths.join(' ')} ${options.recursive ? '-r' : ''}`
      );
    }

    if (fixResults.some((r: any) => !r.success)) {
      const failed = fixResults.filter((r: any) => !r.success);
      console.log(`\n❌ Не удалось исправить ${failed.length} файлов:`);
      for (const fail of failed) {
        console.log(`   📄 ${path.basename(fail.file)}: ${fail.errors.join(', ')}`);
      }
      process.exit(1);
    }
  });

/**
 * Команда: check-and-fix - полный цикл
 */
program
  .command('check-and-fix <paths...>')
  .description('Полный цикл: проверка → исправление → повторная проверка')
  .option('-r, --recursive', 'Рекурсивный поиск файлов в директориях', false)
  .option('--no-backup', 'Не создавать резервные копии файлов', false)
  .option('--max-iterations <number>', 'Максимальное количество итераций', '3')
  .action(async (paths: string[], options: any) => {
    console.log('\n🔄 ЗАПУСК ПОЛНОГО ЦИКЛА: ПРОВЕРКА → ИСПРАВЛЕНИЕ → ПРОВЕРКА');
    console.log('='.repeat(60));

    const files = await collectFiles(paths, options.recursive);

    if (files.length === 0) {
      console.error('❌ Не найдено файлов для обработки');
      process.exit(1);
    }

    console.log(`📁 Найдено файлов: ${files.length}\n`);

    let iteration = 0;
    const maxIterations = parseInt(options.maxIterations);
    let allIssuesFixed = false;

    while (iteration < maxIterations && !allIssuesFixed) {
      iteration++;
      console.log(`\n🔄 ИТЕРАЦИЯ ${iteration}/${maxIterations}`);
      console.log('-'.repeat(40));

      // Проверка
      const validator = new CodeValidator();
      const result = await validator.validateFiles(files);

      console.log('\n📊 ТЕКУЩЕЕ СОСТОЯНИЕ:');
      console.log(`   ❌ Ошибок: ${result.summary.errors}`);
      console.log(`   ⚠️  Предупреждений: ${result.summary.warnings}`);
      console.log(`   🔧 Автоисправимых: ${result.summary.autoFixable}`);

      if (result.summary.errors === 0 && result.summary.warnings === 0) {
        console.log('\n✨ КОД В ИДЕАЛЬНОМ СОСТОЯНИИ!');
        allIssuesFixed = true;
        break;
      }

      if (result.summary.autoFixable === 0) {
        console.log('\n⚠️ Остались проблемы, но они не могут быть исправлены автоматически');
        console.log('   Сохранение отчёта оставшихся проблем...');
        await validator.saveReport(result, './remaining-issues.md');
        console.log('   📄 Отчёт: remaining-issues.md');
        break;
      }

      // Исправление
      console.log('\n🔧 ИСПРАВЛЕНИЕ АВТОИСПРАВИМЫХ ПРОБЛЕМ...');
      const fixer = new CodeFixer();
      const fixResults = await fixer.autoFix(result.issues, options.backup);
      const totalFixes = fixResults.reduce((sum: number, r: any) => sum + r.fixes, 0);
      console.log(`   ✅ Исправлено проблем: ${totalFixes}`);
    }

    if (iteration >= maxIterations && !allIssuesFixed) {
      console.log(`\n⚠️ Достигнуто максимальное количество итераций (${maxIterations})`);
      console.log('   Некоторые проблемы могут требовать ручного исправления');

      // Финальная проверка
      const validator = new CodeValidator();
      const finalResult = await validator.validateFiles(files);
      await validator.saveReport(finalResult, './final-report.md');
      console.log('   📄 Финальный отчёт: final-report.md');
    }

    console.log('\n✅ ПОЛНЫЙ ЦИКЛ ЗАВЕРШЁН!');
  });

/**
 * Команда: report - генерация отчёта
 */
program
  .command('report <paths...>')
  .description('Сгенерировать детальный HTML отчёт о состоянии кода')
  .option('-r, --recursive', 'Рекурсивный поиск', false)
  .option('-o, --output <file>', 'Выходной файл', './code-report.html')
  .action(async (paths: string[], options: any) => {
    console.log('\n📊 ГЕНЕРАЦИЯ ОТЧЁТА О СОСТОЯНИИ КОДА');
    console.log('='.repeat(60));

    const files = await collectFiles(paths, options.recursive);

    if (files.length === 0) {
      console.error('❌ Не найдено файлов');
      process.exit(1);
    }

    const validator = new CodeValidator();
    const result = await validator.validateFiles(files);

    // Генерация HTML отчёта
    const htmlReport = generateHTMLReport(result, files);
    await fs.promises.writeFile(options.output, htmlReport, 'utf-8');

    console.log(`\n✅ Отчёт сохранён: ${options.output}`);
    console.log('   Откройте файл в браузере для детального просмотра');
  });

/**
 * Команда: stats - статистика по проекту
 */
program
  .command('stats <paths...>')
  .description('Показать статистику по проекту')
  .option('-r, --recursive', 'Рекурсивный поиск', false)
  .action(async (paths: string[], options: any) => {
    console.log('\n📊 СТАТИСТИКА ПРОЕКТА');
    console.log('='.repeat(60));

    const files = await collectFiles(paths, options.recursive);

    if (files.length === 0) {
      console.error('❌ Не найдено файлов');
      process.exit(1);
    }

    let totalLines = 0;
    let totalSize = 0;
    const byExtension: Record<string, { count: number; lines: number; size: number }> = {};

    for (const file of files) {
      const ext = path.extname(file);
      const content = await fs.promises.readFile(file, 'utf-8');
      const lines = content.split('\n').length;
      const size = content.length;

      totalLines += lines;
      totalSize += size;

      if (!byExtension[ext]) {
        byExtension[ext] = { count: 0, lines: 0, size: 0 };
      }
      byExtension[ext].count++;
      byExtension[ext].lines += lines;
      byExtension[ext].size += size;
    }

    console.log('\n📁 ОБЩАЯ СТАТИСТИКА:');
    console.log(`   📄 Файлов: ${files.length}`);
    console.log(`   📝 Строк кода: ${totalLines.toLocaleString()}`);
    console.log(`   💾 Размер: ${(totalSize / 1024).toFixed(2)} KB`);

    console.log('\n📊 ПО РАСШИРЕНИЯМ:');
    for (const [ext, stats] of Object.entries(byExtension)) {
      console.log(`   ${ext || 'без расширения'}:`);
      console.log(`      Файлов: ${stats.count}`);
      console.log(`      Строк: ${stats.lines.toLocaleString()}`);
      console.log(`      Размер: ${(stats.size / 1024).toFixed(2)} KB`);
    }
  });

/**
 * Сбор файлов для проверки
 */
async function collectFiles(paths: string[], recursive: boolean): Promise<string[]> {
  const files: string[] = [];
  const extensions = ['.js', '.ts', '.mjs', '.cjs', '.jsx', '.tsx', '.vue'];

  for (const inputPath of paths) {
    if (!fs.existsSync(inputPath)) {
      console.warn(`⚠️ Путь не существует: ${inputPath}`);
      continue;
    }

    const stat = fs.statSync(inputPath);

    if (stat.isFile()) {
      if (extensions.includes(path.extname(inputPath))) {
        files.push(path.resolve(inputPath));
      } else {
        console.warn(`⚠️ Пропущен файл с неподдерживаемым расширением: ${inputPath}`);
      }
    } else if (stat.isDirectory()) {
      const pattern = recursive
        ? `${inputPath}/**/*{${extensions.join(',')}}`
        : `${inputPath}/*{${extensions.join(',')}}`;

      const matched = await glob(pattern, {
        nodir: true,
        ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/coverage/**'],
      });
      files.push(...matched.map(f => path.resolve(f)));
    }
  }

  return [...new Set(files)];
}

/**
 * Генерация HTML отчёта
 */
function generateHTMLReport(result: any, files: string[]): string {
  const errorsByFile = new Map<string, any[]>();

  for (const issue of result.issues) {
    if (!errorsByFile.has(issue.file)) {
      errorsByFile.set(issue.file, []);
    }
    errorsByFile.get(issue.file)!.push(issue);
  }

  return `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Отчёт о состоянии кода</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
            min-height: 100vh;
        }
        .container {
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px 40px;
        }
        .header h1 { font-size: 28px; margin-bottom: 10px; }
        .header .date { opacity: 0.9; font-size: 14px; }
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            padding: 30px 40px;
            background: #f8f9fa;
            border-bottom: 1px solid #e9ecef;
        }
        .summary-card {
            background: white;
            padding: 20px;
            border-radius: 12px;
            text-align: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .summary-card .number {
            font-size: 36px;
            font-weight: bold;
            margin-bottom: 8px;
        }
        .summary-card .label {
            color: #6c757d;
            font-size: 14px;
        }
        .summary-card.error .number { color: #dc3545; }
        .summary-card.warning .number { color: #ffc107; }
        .summary-card.info .number { color: #17a2b8; }
        .summary-card.fixable .number { color: #28a745; }
        .content { padding: 30px 40px; }
        .file-section {
            margin-bottom: 30px;
            border: 1px solid #e9ecef;
            border-radius: 12px;
            overflow: hidden;
        }
        .file-header {
            background: #f8f9fa;
            padding: 15px 20px;
            cursor: pointer;
            font-weight: 600;
            border-bottom: 1px solid #e9ecef;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .file-header:hover { background: #e9ecef; }
        .file-name { font-family: monospace; font-size: 14px; }
        .badge {
            padding: 4px 8px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 500;
        }
        .badge.error { background: #dc3545; color: white; }
        .badge.warning { background: #ffc107; color: #000; }
        .badge.info { background: #17a2b8; color: white; }
        .issues-list { padding: 0; }
        .issue {
            padding: 12px 20px;
            border-bottom: 1px solid #f0f0f0;
            display: flex;
            align-items: flex-start;
            gap: 12px;
        }
        .issue:last-child { border-bottom: none; }
        .issue-icon {
            font-size: 20px;
            min-width: 24px;
        }
        .issue-content { flex: 1; }
        .issue-message { margin-bottom: 4px; }
        .issue-location {
            font-size: 12px;
            color: #6c757d;
            font-family: monospace;
        }
        .issue-suggestion {
            margin-top: 6px;
            padding: 6px 10px;
            background: #fff3cd;
            border-radius: 6px;
            font-size: 13px;
            color: #856404;
        }
        .footer {
            padding: 20px 40px;
            background: #f8f9fa;
            text-align: center;
            color: #6c757d;
            font-size: 12px;
            border-top: 1px solid #e9ecef;
        }
        button {
            background: none;
            border: none;
            font-size: 16px;
            cursor: pointer;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔍 Отчёт о состоянии кода</h1>
            <div class="date">Дата: ${new Date(result.timestamp).toLocaleString()}</div>
        </div>
        
        <div class="summary">
            <div class="summary-card error">
                <div class="number">${result.summary.errors}</div>
                <div class="label">❌ Ошибки</div>
            </div>
            <div class="summary-card warning">
                <div class="number">${result.summary.warnings}</div>
                <div class="label">⚠️ Предупреждения</div>
            </div>
            <div class="summary-card info">
                <div class="number">${result.summary.info}</div>
                <div class="label">ℹ️ Замечания</div>
            </div>
            <div class="summary-card fixable">
                <div class="number">${result.summary.autoFixable}</div>
                <div class="label">🔧 Автоисправимые</div>
            </div>
        </div>
        
        <div class="content">
            <h2>📁 Проблемы по файлам</h2>
            <br>
            
            ${Array.from(errorsByFile.entries())
              .map(
                ([file, issues]) => `
                <div class="file-section">
                    <div class="file-header" onclick="toggleIssues(this)">
                        <span class="file-name">📄 ${path.basename(file)}</span>
                        <div>
                            ${issues.filter((i: any) => i.type === 'error').length > 0 ? `<span class="badge error">${issues.filter((i: any) => i.type === 'error').length} ошибок</span>` : ''}
                            ${issues.filter((i: any) => i.type === 'warning').length > 0 ? `<span class="badge warning">${issues.filter((i: any) => i.type === 'warning').length} предупреждений</span>` : ''}
                            ${issues.filter((i: any) => i.type === 'info').length > 0 ? `<span class="badge info">${issues.filter((i: any) => i.type === 'info').length} замечаний</span>` : ''}
                            <button>▼</button>
                        </div>
                    </div>
                    <div class="issues-list" style="display: block;">
                        ${issues
                          .map(
                            (issue: any) => `
                            <div class="issue">
                                <div class="issue-icon">
                                    ${issue.type === 'error' ? '❌' : issue.type === 'warning' ? '⚠️' : 'ℹ️'}
                                </div>
                                <div class="issue-content">
                                    <div class="issue-message">${escapeHtml(issue.message)}</div>
                                    ${issue.line ? `<div class="issue-location">Строка ${issue.line}${issue.column ? `, колонка ${issue.column}` : ''}</div>` : ''}
                                    ${issue.suggestion ? `<div class="issue-suggestion">💡 ${escapeHtml(issue.suggestion)}</div>` : ''}
                                    ${issue.autoFixable ? '<div class="issue-suggestion" style="background: #d4edda; color: #155724;">🔧 Может быть исправлено автоматически</div>' : ''}
                                </div>
                            </div>
                        `
                          )
                          .join('')}
                    </div>
                </div>
            `
              )
              .join('')}
            
            ${errorsByFile.size === 0 ? '<p style="text-align: center; padding: 40px;">✨ Проблем не найдено! Код в отличном состоянии.</p>' : ''}
        </div>
        
        <div class="footer">
            <p>Сгенерировано AST Validator v1.0.0</p>
            <p>Всего проверено файлов: ${files.length}</p>
        </div>
    </div>
    
    <script>
        function toggleIssues(header) {
            const issuesList = header.nextElementSibling;
            const button = header.querySelector('button');
            if (issuesList.style.display === 'none') {
                issuesList.style.display = 'block';
                button.textContent = '▼';
            } else {
                issuesList.style.display = 'none';
                button.textContent = '▶';
            }
        }
    </script>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Запуск CLI
if (process.argv.length <= 2) {
  program.help();
}

program.parse();
