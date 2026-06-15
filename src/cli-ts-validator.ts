#!/usr/bin/env node

/**
 * CLI для TypeScript валидации и автоматического исправления через AST
 *
 * Использование:
 *   npx ast-ts-validator check <paths...> [options]
 *   npx ast-ts-validator fix <paths...> [options]
 *   npx ast-ts-validator watch <paths...> [options]
 */

import { Command } from 'commander';
import { TypeScriptValidator } from './refactor/TypeScriptValidator.js';
import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import { askQuestion } from './utils/askQuestion.js';

const program = new Command();

program
  .name('ast-ts-validator')
  .description('🔍 TypeScript валидация и автоматическое исправление через AST')
  .version('1.0.0');

/**
 * Команда: check - только проверка
 */
program
  .command('check <paths...>')
  .description('Проверить TypeScript ошибки (без исправлений)')
  .option('-r, --recursive', 'Рекурсивный поиск', false)
  .option('-j, --json', 'Вывод в JSON формате', false)
  .action(async (paths: string[], options: any) => {
    console.log('\n🔍 TypeScript ПРОВЕРКА');
    console.log('='.repeat(60));

    const files = await collectFiles(paths, options.recursive);

    if (files.length === 0) {
      console.error('❌ Не найдено TypeScript файлов');
      process.exit(1);
    }

    console.log(`📁 Найдено файлов: ${files.length}\n`);

    const validator = new TypeScriptValidator();
    const result = await validator.validateAndFix(files, 0); // 0 итераций = только проверка

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      // Вывод краткой информации в консоль
      console.log('\n📊 РЕЗУЛЬТАТЫ ПРОВЕРКИ:');
      console.log(`   ✅ Успешно: ${result.success ? 'ДА' : 'НЕТ'}`);
      console.log(`   ❌ Ошибок: ${result.remainingErrors}`);
      console.log(`   🔧 Исправлено: ${result.fixedCount}`);

      if (result.diagnostics && result.diagnostics.length > 0) {
        console.log('\n   ОШИБКИ:');
        for (const diag of result.diagnostics.slice(0, 10)) {
          console.log(
            `   📄 ${path.basename(diag.file)}:${diag.line} - TS${diag.code}: ${diag.message.substring(0, 80)}`
          );
        }
        if (result.diagnostics.length > 10) {
          console.log(`   ... и ещё ${result.diagnostics.length - 10} ошибок`);
        }
      }
    }

    process.exit(result.success ? 0 : 1);
  });

/**
 * Команда: fix - проверка и исправление
 */
program
  .command('fix <paths...>')
  .description('Проверить и автоматически исправить TypeScript ошибки через AST')
  .option('-r, --recursive', 'Рекурсивный поиск', false)
  .option('-i, --iterations <number>', 'Максимум итераций', '5')
  .option('--no-backup', 'Не создавать бэкапы', false)
  .action(async (paths: string[], options: any) => {
    console.log('\n🔧 TypeScript АВТОИСПРАВЛЕНИЕ ЧЕРЕЗ AST');
    console.log('='.repeat(60));

    const files = await collectFiles(paths, options.recursive);

    if (files.length === 0) {
      console.error('❌ Не найдено TypeScript файлов');
      process.exit(1);
    }

    console.log(`📁 Найдено файлов: ${files.length}\n`);

    // Создаём бэкапы
    const backups: string[] = [];
    if (options.backup !== false) {
      for (const file of files) {
        const backupPath = `${file}.backup.${Date.now()}`;
        fs.copyFileSync(file, backupPath);
        backups.push(backupPath);
      }
      console.log(`💾 Создано бэкапов: ${backups.length}\n`);
    }

    const validator = new TypeScriptValidator();
    const result = await validator.validateAndFix(files, parseInt(options.iterations));

    console.log('\n📊 ИТОГИ ИСПРАВЛЕНИЯ:');
    console.log(`   🔧 Исправлено: ${result.fixedCount}`);
    console.log(`   ❌ Осталось ошибок: ${result.remainingErrors}`);

    if (result.success) {
      console.log('\n✨ ВСЕ ОШИБКИ TYPESCRIPT ИСПРАВЛЕНЫ!');
    } else {
      console.log(`\n⚠️ Осталось ${result.remainingErrors} ошибок, требующих ручного исправления`);

      if (result.diagnostics && result.diagnostics.length > 0) {
        console.log('\n   НЕИСПРАВЛЕННЫЕ ОШИБКИ:');
        for (const diag of result.diagnostics.slice(0, 10)) {
          console.log(
            `   📄 ${path.basename(diag.file)}:${diag.line} - ${diag.message.substring(0, 80)}`
          );
        }
      }

      process.exit(1);
    }
  });

/**
 * Команда: watch - слежение за изменениями
 */
program
  .command('watch <paths...>')
  .description('Следить за файлами и автоматически исправлять ошибки')
  .option('-r, --recursive', 'Рекурсивный поиск', false)
  .action(async (paths: string[], options: any) => {
    console.log('\n👁️ TypeScript WATCH MODE');
    console.log('='.repeat(60));
    console.log('Слежение за файлами... Нажмите Ctrl+C для выхода\n');

    const files = await collectFiles(paths, options.recursive);
    const fileSet = new Set(files);

    // Функция проверки и исправления
    const checkAndFix = async () => {
      const validator = new TypeScriptValidator();
      const result = await validator.validateAndFix(Array.from(fileSet), 3);

      if (result.success) {
        console.log(`✅ [${new Date().toLocaleTimeString()}] Все ошибки исправлены`);
      } else if (result.fixedCount > 0) {
        console.log(
          `🔧 [${new Date().toLocaleTimeString()}] Исправлено: ${result.fixedCount}, осталось: ${result.remainingErrors}`
        );
      }
    };

    // Первоначальная проверка
    await checkAndFix();

    // Слежение за изменениями
    const watchers: fs.FSWatcher[] = [];
    for (const dir of [...new Set(files.map(f => path.dirname(f)))]) {
      const watcher = fs.watch(
        dir,
        { recursive: true },
        (_eventType: string, filename: string | null) => {
          if (
            filename &&
            (filename.endsWith('.ts') || filename.endsWith('.tsx') || filename.endsWith('.js'))
          ) {
            const fullPath = path.join(dir, filename);
            if (fileSet.has(fullPath) || fs.existsSync(fullPath)) {
              fileSet.add(fullPath);
              checkAndFix().catch(console.error);
            }
          }
        }
      );
      watchers.push(watcher);
    }

    // Обработка выхода
    process.on('SIGINT', () => {
      console.log('\n\n👋 Завершение работы...');
      watchers.forEach(w => w.close());
      process.exit(0);
    });
  });

/**
 * Команда: init - создание tsconfig.json если нет
 */
program
  .command('init')
  .description('Создать базовый tsconfig.json для проекта')
  .action(async () => {
    const tsconfigPath = path.join(process.cwd(), 'tsconfig.json');

    if (fs.existsSync(tsconfigPath)) {
      console.log('⚠️ tsconfig.json уже существует');
      const answer = await askQuestion('Перезаписать? (y/N): ');
      if (answer.toLowerCase() !== 'y') {
        console.log('❌ Отменено');
        process.exit(0);
      }
    }

    const tsconfig = {
      compilerOptions: {
        target: 'ES2020',
        module: 'ESNext',
        moduleResolution: 'node',
        lib: ['ES2020'],
        allowJs: true,
        checkJs: true,
        jsx: 'preserve',
        strict: false,
        noImplicitAny: false,
        strictNullChecks: false,
        skipLibCheck: true,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        resolveJsonModule: true,
        isolatedModules: true,
        noEmit: true,
      },
      include: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
      exclude: ['node_modules', 'dist', 'build', 'coverage'],
    };

    fs.writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2));
    console.log(`✅ Создан tsconfig.json: ${tsconfigPath}`);
  });

/**
 * Команда: report - генерация отчёта
 */
program
  .command('report <paths...>')
  .description('Сгенерировать детальный HTML отчёт о TypeScript ошибках')
  .option('-r, --recursive', 'Рекурсивный поиск', false)
  .option('-o, --output <file>', 'Выходной файл', './ts-report.html')
  .action(async (paths: string[], options: any) => {
    console.log('\n📊 ГЕНЕРАЦИЯ ОТЧЁТА TYPESCRIPT');
    console.log('='.repeat(60));

    const files = await collectFiles(paths, options.recursive);

    if (files.length === 0) {
      console.error('❌ Не найдено TypeScript файлов');
      process.exit(1);
    }

    console.log(`📁 Найдено файлов: ${files.length}\n`);

    const validator = new TypeScriptValidator();
    const result = await validator.validateAndFix(files, 0);

    const html = generateHTMLReport(result, files);
    fs.writeFileSync(options.output, html);

    console.log(`✅ Отчёт сохранён: ${options.output}`);
  });

/**
 * Сбор файлов
 */
async function collectFiles(paths: string[], recursive: boolean): Promise<string[]> {
  const files: string[] = [];
  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

  for (const inputPath of paths) {
    if (!fs.existsSync(inputPath)) {
      console.warn(`⚠️ Путь не существует: ${inputPath}`);
      continue;
    }

    const stat = fs.statSync(inputPath);

    if (stat.isFile()) {
      if (extensions.includes(path.extname(inputPath))) {
        files.push(path.resolve(inputPath));
      }
    } else if (stat.isDirectory()) {
      const pattern = recursive
        ? `${inputPath}/**/*{${extensions.join(',')}}`
        : `${inputPath}/*{${extensions.join(',')}}`;

      const matched = await glob(pattern, {
        nodir: true,
        ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/coverage/**', '**/*.d.ts'],
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
  const success = result.success;
  const totalErrors = result.remainingErrors;
  const totalFixes = result.fixedCount;
  const diagnostics = result.diagnostics || [];

  const byFile = new Map<string, typeof diagnostics>();
  for (const diag of diagnostics) {
    if (!byFile.has(diag.file)) {
      byFile.set(diag.file, []);
    }
    const fileDiags = byFile.get(diag.file);
    if (fileDiags) {
      fileDiags.push(diag);
    }
  }

  return `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TypeScript Отчёт</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            padding: 20px;
            min-height: 100vh;
        }
        .container {
            max-width: 1400px;
            margin: 0 auto;
            background: #0f0f23;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.5);
            overflow: hidden;
            border: 1px solid #2a2a4a;
        }
        .header {
            background: linear-gradient(135deg, #0f3460 0%, #16213e 100%);
            padding: 30px 40px;
            border-bottom: 1px solid #2a2a4a;
        }
        .header h1 { 
            color: #00d9ff; 
            font-size: 28px; 
            margin-bottom: 10px;
            font-family: monospace;
        }
        .header .date { 
            color: #8899aa; 
            font-size: 14px; 
        }
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            padding: 30px 40px;
            background: #0a0a1a;
            border-bottom: 1px solid #2a2a4a;
        }
        .summary-card {
            background: #111128;
            padding: 20px;
            border-radius: 12px;
            text-align: center;
            border: 1px solid #2a2a4a;
        }
        .summary-card .number {
            font-size: 36px;
            font-weight: bold;
            margin-bottom: 8px;
            font-family: monospace;
        }
        .summary-card .label {
            color: #8899aa;
            font-size: 14px;
        }
        .summary-card.success .number { color: #00ff88; }
        .summary-card.error .number { color: #ff4444; }
        .summary-card.fix .number { color: #ffaa00; }
        .content { padding: 30px 40px; }
        .file-section {
            margin-bottom: 30px;
            border: 1px solid #2a2a4a;
            border-radius: 12px;
            overflow: hidden;
        }
        .file-header {
            background: #0a0a1a;
            padding: 15px 20px;
            cursor: pointer;
            font-weight: 600;
            border-bottom: 1px solid #2a2a4a;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-family: monospace;
        }
        .file-header:hover { background: #111128; }
        .file-name { color: #00d9ff; font-size: 14px; }
        .badge {
            padding: 4px 8px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 500;
        }
        .badge.error { background: #ff4444; color: white; }
        .diagnostics-list { padding: 0; }
        .diagnostic {
            padding: 12px 20px;
            border-bottom: 1px solid #1a1a3a;
            display: flex;
            align-items: flex-start;
            gap: 12px;
            font-family: monospace;
            font-size: 13px;
        }
        .diagnostic:last-child { border-bottom: none; }
        .diagnostic-code {
            background: #1a1a3a;
            padding: 2px 6px;
            border-radius: 4px;
            color: #ffaa00;
            font-weight: bold;
            min-width: 60px;
        }
        .diagnostic-message { flex: 1; color: #ccddee; }
        .diagnostic-location { color: #6688aa; font-size: 11px; }
        .footer {
            padding: 20px 40px;
            background: #0a0a1a;
            text-align: center;
            color: #6688aa;
            font-size: 12px;
            border-top: 1px solid #2a2a4a;
        }
        button {
            background: none;
            border: none;
            font-size: 16px;
            cursor: pointer;
            color: #8899aa;
        }
        .success-banner {
            background: #00aa4422;
            border: 1px solid #00ff88;
            border-radius: 8px;
            padding: 20px;
            text-align: center;
            margin-bottom: 20px;
        }
        .success-banner h2 { color: #00ff88; margin-bottom: 10px; }
        .error-banner {
            background: #ff444422;
            border: 1px solid #ff4444;
            border-radius: 8px;
            padding: 20px;
            text-align: center;
            margin-bottom: 20px;
        }
        .error-banner h2 { color: #ff4444; margin-bottom: 10px; }
        pre {
            background: #0a0a1a;
            padding: 15px;
            border-radius: 8px;
            overflow-x: auto;
            font-size: 12px;
            color: #ccddee;
        }
    </style>
    <script>
        function toggleDiagnostics(header) {
            const list = header.nextElementSibling;
            const button = header.querySelector('button');
            if (list.style.display === 'none') {
                list.style.display = 'block';
                button.textContent = '▼';
            } else {
                list.style.display = 'none';
                button.textContent = '▶';
            }
        }
    </script>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔷 TypeScript Validation Report</h1>
            <div class="date">📅 ${new Date().toLocaleString()}</div>
        </div>
        
        <div class="summary">
            <div class="summary-card ${success ? 'success' : 'error'}">
                <div class="number">${success ? '✅' : '❌'}</div>
                <div class="label">Статус</div>
            </div>
            <div class="summary-card error">
                <div class="number">${totalErrors}</div>
                <div class="label">❌ Ошибок</div>
            </div>
            <div class="summary-card fix">
                <div class="number">${totalFixes}</div>
                <div class="label">🔧 Исправлено</div>
            </div>
            <div class="summary-card">
                <div class="number">${files.length}</div>
                <div class="label">📁 Файлов</div>
            </div>
        </div>
        
        <div class="content">
            ${
              success
                ? `
            <div class="success-banner">
                <h2>✨ ВСЕ ОШИБКИ УСПЕШНО ИСПРАВЛЕНЫ!</h2>
                <p>TypeScript проверка пройдена. Код валиден.</p>
            </div>
            `
                : `
            <div class="error-banner">
                <h2>⚠️ ОБНАРУЖЕНЫ ОШИБКИ</h2>
                <p>Найдено ${totalErrors} ошибок TypeScript. ${totalFixes} ошибок было исправлено автоматически.</p>
            </div>
            `
            }
            
            ${
              byFile.size > 0
                ? `
            <h2 style="margin-bottom: 20px; color: #00d9ff;">📁 Ошибки по файлам</h2>
            ${Array.from(byFile.entries())
              .map(
                ([file, issues]) => `
            <div class="file-section">
                <div class="file-header" onclick="toggleDiagnostics(this)">
                    <span class="file-name">📄 ${path.basename(file)}</span>
                    <div>
                        <span class="badge error">${issues.length} ошибок</span>
                        <button>▼</button>
                    </div>
                </div>
                <div class="diagnostics-list" style="display: block;">
                    ${issues
                      .map(
                        (issue: any) => `
                    <div class="diagnostic">
                        <div class="diagnostic-code">TS${issue.code}</div>
                        <div class="diagnostic-message">${escapeHtml(issue.message)}</div>
                        <div class="diagnostic-location">строка ${issue.line}, колонка ${issue.column}</div>
                    </div>
                    `
                      )
                      .join('')}
                </div>
            </div>
            `
              )
              .join('')}
            `
                : success
                  ? ''
                  : '<p style="text-align: center; padding: 40px; color: #00ff88;">✨ Нет ошибок TypeScript!</p>'
            }
        </div>
        
        <div class="footer">
            <p>Сгенерировано AST TypeScript Validator v1.0.0</p>
            <p>🔧 Все изменения вносятся непосредственно в AST дерево</p>
        </div>
    </div>
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

// Запуск
if (process.argv.length <= 2) {
  program.help();
}

program.parse();
