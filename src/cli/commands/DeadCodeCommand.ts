// packages/ast-analyzer/src/cli/commands/DeadCodeCommand.ts
// НОВЫЙ ФАЙЛ - Полный текст

import type { Command } from 'commander';
import path from 'path';
import fs from 'fs';

/**
 * Команда для поиска мертвого кода
 *
 * Использование:
 *   npx ast-analyzer dead-code <file> [options]
 *
 * Опции:
 *   -o, --output <file>  Выходной файл отчета (по умолчанию: ai-dead-code-report.md)
 *   --json               Вывод в JSON формате
 *   --no-markdown        Отключить генерацию Markdown отчета
 *   -v, --verbose        Подробный вывод
 */
export class DeadCodeCommand {
  private program: Command;

  constructor(program: Command) {
    this.program = program;
    this.register();
  }

  private register(): void {
    this.program
      .command('dead-code <file>')
      .description('Find dead code (unused functions, exports, variables, imports)')
      .alias('dead')
      .option('-o, --output <file>', 'Output file for report', 'ai-dead-code-report.md')
      .option('--json', 'Output in JSON format')
      .option('--no-markdown', 'Skip Markdown report generation')
      .option('--no-json', 'Skip JSON output')
      .option('-v, --verbose', 'Verbose output')
      .option('--include-tests', 'Include test files in analysis', false)
      .option('--include-exports', 'Check unused exports', true)
      .option('--include-imports', 'Check unused imports', true)
      .option('--include-variables', 'Check unused variables', true)
      .option('--include-functions', 'Check unused functions', true)
      .option('--threshold <n>', 'Minimum usage count to consider used', '1')
      .option('--exclude <patterns>', 'Exclude patterns (comma-separated)')
      .action(async (file, options) => {
        try {
          await this.execute(file, options);
        } catch (error) {
          console.error('❌ Dead code analysis failed:', error);
          process.exit(1);
        }
      });
  }

  /**
   * Выполняет анализ мертвого кода
   */
  private async execute(file: string, options: any): Promise<void> {
    console.log('🗑️ Finding dead code...');
    console.log(`📄 File: ${file}`);

    const resolvedPath = path.resolve(file);
    if (!fs.existsSync(resolvedPath)) {
      console.error(`❌ File not found: ${resolvedPath}`);
      process.exit(1);
    }

    const isDirectory = fs.statSync(resolvedPath).isDirectory();

    // Если это директория, анализируем все файлы
    if (isDirectory) {
      await this.analyzeDirectory(resolvedPath, options);
      return;
    }

    // Анализируем один файл
    await this.analyzeFile(resolvedPath, options);
  }

  /**
   * Анализирует директорию
   */
  private async analyzeDirectory(dir: string, options: any): Promise<void> {
    console.log(`📁 Analyzing directory: ${dir}`);

    const { glob } = await import('glob');
    const excludePatterns = options.exclude
      ? options.exclude.split(',').map((p: string) => p.trim())
      : ['**/node_modules/**', '**/dist/**', '**/build/**'];

    const patterns = ['**/*.{ts,tsx,js,jsx,mjs,cjs}'];

    if (options.includeTests) {
      patterns.push('**/*.{test,spec}.{ts,tsx,js,jsx}');
    }

    const files = await glob(patterns, {
      cwd: dir,
      ignore: excludePatterns,
      absolute: true,
    });

    console.log(`📄 Found ${files.length} files to analyze\n`);

    let totalIssues = 0;
    const allResults: any[] = [];

    for (const file of files) {
      const result = await this.analyzeSingleFile(file, options);
      if (result && result.issues.length > 0) {
        allResults.push(result);
        totalIssues += result.issues.length;
      }
    }

    // Выводим сводку
    console.log('\n' + '='.repeat(60));
    console.log('📊 DEAD CODE SUMMARY');
    console.log('='.repeat(60));
    console.log(`📁 Files analyzed: ${files.length}`);
    console.log(`🗑️ Issues found: ${totalIssues}`);
    console.log(`📄 Files with issues: ${allResults.length}`);

    // Сохраняем отчет
    const outputPath = path.resolve(options.output);
    if (options.markdown !== false) {
      const report = this.generateDirectoryReport(allResults, dir);
      fs.writeFileSync(outputPath, report);
      console.log(`\n📄 Report saved: ${outputPath}`);
    }

    if (options.json) {
      const jsonPath = outputPath.replace(/\.md$/, '.json');
      fs.writeFileSync(jsonPath, JSON.stringify(allResults, null, 2));
      console.log(`📄 JSON saved: ${jsonPath}`);
    }

    if (totalIssues > 0) {
      console.log(`\n⚠️ Found ${totalIssues} dead code issues`);
      process.exit(1);
    } else {
      console.log('\n✅ No dead code found!');
    }
  }

  /**
   * Анализирует один файл
   */
  private async analyzeFile(file: string, options: any): Promise<void> {
    const result = await this.analyzeSingleFile(file, options);

    if (options.verbose) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📄 ${path.basename(file)}`);
      console.log('='.repeat(60));
      console.log(`📊 Functions: ${result.functions.total}`);
      console.log(`   🗑️ Unused: ${result.functions.unused.length}`);
      console.log(`📊 Exports: ${result.exports.total}`);
      console.log(`   🗑️ Unused: ${result.exports.unused.length}`);
      console.log(`📊 Variables: ${result.variables.total}`);
      console.log(`   🗑️ Unused: ${result.variables.unused.length}`);
      console.log(`📊 Imports: ${result.imports.total}`);
      console.log(`   🗑️ Unused: ${result.imports.unused.length}`);
    }

    // Генерируем отчет
    const outputPath = path.resolve(options.output);
    if (options.markdown !== false) {
      const report = this.generateReport(result, file);
      fs.writeFileSync(outputPath, report);
      console.log(`\n📄 Report saved: ${outputPath}`);
    }

    if (options.json) {
      const jsonPath = outputPath.replace(/\.md$/, '.json');
      fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2));
      console.log(`📄 JSON saved: ${jsonPath}`);
    }

    const totalIssues = result.issues.length;
    if (totalIssues > 0) {
      console.log(`\n⚠️ Found ${totalIssues} dead code issues`);
      process.exit(1);
    } else {
      console.log('\n✅ No dead code found!');
    }
  }

  /**
   * Анализирует один файл и возвращает результаты
   */
  private async analyzeSingleFile(file: string, options: any): Promise<any> {
    const { parseFile } = await import('../../core/ast-parser.js');
    const { extractEntities } = await import('../../core/entity-extractor.js');

    const parsed = parseFile(file);
    if (!parsed) {
      return {
        file,
        functions: { total: 0, unused: [] },
        exports: { total: 0, unused: [] },
        variables: { total: 0, unused: [] },
        imports: { total: 0, unused: [] },
        issues: [],
        error: 'Failed to parse file',
      };
    }

    const entities = extractEntities(parsed.ast, file);
    const content = fs.readFileSync(file, 'utf-8');

    const result = {
      file,
      functions: { total: 0, unused: [] as { name: string; line: number; usageCount: number }[] },
      exports: { total: 0, unused: [] as { name: string; line: number }[] },
      variables: { total: 0, unused: [] as { name: string; line: number; usageCount: number }[] },
      imports: { total: 0, unused: [] as { name: string; source: string; line: number }[] },
      issues: [] as any[],
    };

    // Проверяем функции
    if (options.includeFunctions !== false) {
      for (const func of entities.functions || []) {
        result.functions.total++;
        const usageCount = this.countUsage(content, func.name);
        if (usageCount <= parseInt(options.threshold) && !func.isExported) {
          result.functions.unused.push({
            name: func.name,
            line: func.line,
            usageCount,
          });
          result.issues.push({
            type: 'function',
            name: func.name,
            line: func.line,
            message: `Function '${func.name}' is never used`,
            suggestion: 'Remove the function or use it elsewhere',
          });
        }
      }
    }

    // Проверяем экспорты
    if (options.includeExports !== false) {
      for (const exp of entities.exports || []) {
        result.exports.total++;
        // Проверяем, используется ли экспорт в других файлах
        // (это сложная проверка, упрощенно)
        if (!exp.isDefault) {
          result.exports.unused.push({
            name: exp.name,
            line: exp.loc?.start?.line || 0,
          });
        }
      }
    }

    // Проверяем переменные
    if (options.includeVariables !== false) {
      for (const variable of entities.variables || []) {
        result.variables.total++;
        const usageCount = this.countUsage(content, variable.name);
        if (usageCount <= parseInt(options.threshold) && !variable.isExported) {
          result.variables.unused.push({
            name: variable.name,
            line: variable.line,
            usageCount,
          });
          result.issues.push({
            type: 'variable',
            name: variable.name,
            line: variable.line,
            message: `Variable '${variable.name}' is declared but never used`,
            suggestion: 'Remove the variable or use it',
          });
        }
      }
    }

    // Проверяем импорты
    if (options.includeImports !== false) {
      for (const imp of entities.imports || []) {
        result.imports.total++;
        for (const spec of imp.specifiers) {
          const specName = spec.imported || spec.local;
          const usageCount = this.countUsage(content, specName);
          if (usageCount <= parseInt(options.threshold)) {
            result.imports.unused.push({
              name: specName,
              source: imp.source,
              line: imp.loc?.start?.line || 0,
            });
            result.issues.push({
              type: 'import',
              name: specName,
              line: imp.loc?.start?.line || 0,
              message: `Import '${specName}' is never used`,
              suggestion: `Remove import '${specName}' from '${imp.source}'`,
            });
          }
        }
      }
    }

    return result;
  }

  /**
   * Подсчитывает количество использований имени в коде
   */
  private countUsage(content: string, name: string): number {
    if (!name) return 0;

    // Создаем регулярное выражение для поиска использования
    // Используем границы слова, чтобы не находить части других слов
    const regex = new RegExp(`\\b${this.escapeRegex(name)}\\b`, 'g');
    const matches = content.match(regex);
    return matches ? matches.length : 0;
  }

  /**
   * Экранирует специальные символы для регулярного выражения
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Генерирует отчет для одного файла
   */
  private generateReport(result: any, file: string): string {
    let report = '# 🗑️ DEAD CODE REPORT\n\n';
    report += `**File:** \`${file}\`\n`;
    report += `**Generated:** ${new Date().toLocaleString()}\n\n`;

    report += '## 📊 Summary\n\n';
    report += '| Type | Total | Unused |\n';
    report += '|------|-------|--------|\n';
    report += `| Functions | ${result.functions.total} | ${result.functions.unused.length} |\n`;
    report += `| Exports | ${result.exports.total} | ${result.exports.unused.length} |\n`;
    report += `| Variables | ${result.variables.total} | ${result.variables.unused.length} |\n`;
    report += `| Imports | ${result.imports.total} | ${result.imports.unused.length} |\n\n`;

    // Детали по функциям
    if (result.functions.unused.length > 0) {
      report += '## ⚠️ Unused Functions\n\n';
      for (const func of result.functions.unused) {
        report += `- \`${func.name}\` (line ${func.line}) - used ${func.usageCount} times\n`;
      }
      report += '\n';
    }

    // Детали по экспортам
    if (result.exports.unused.length > 0) {
      report += '## ⚠️ Unused Exports\n\n';
      for (const exp of result.exports.unused) {
        report += `- \`${exp.name}\` (line ${exp.line})\n`;
      }
      report += '\n';
    }

    // Детали по переменным
    if (result.variables.unused.length > 0) {
      report += '## ⚠️ Unused Variables\n\n';
      for (const variable of result.variables.unused) {
        report += `- \`${variable.name}\` (line ${variable.line}) - used ${variable.usageCount} times\n`;
      }
      report += '\n';
    }

    // Детали по импортам
    if (result.imports.unused.length > 0) {
      report += '## ⚠️ Unused Imports\n\n';
      for (const imp of result.imports.unused) {
        report += `- \`${imp.name}\` from \`${imp.source}\` (line ${imp.line})\n`;
      }
      report += '\n';
    }

    // Рекомендации
    if (result.issues.length > 0) {
      report += '## 💡 Recommendations\n\n';
      report += '1. **Remove dead code** - Delete unused functions, variables, and imports\n';
      report += '2. **Refactor** - Consider using the code or removing it\n';
      report += '3. **Check exports** - Some exports may be used by other files\n';
      report += '4. **Run tests** - After removing code, ensure everything still works\n';
      report += '\n';
    }

    return report;
  }

  /**
   * Генерирует отчет для директории
   */
  private generateDirectoryReport(results: any[], dir: string): string {
    let report = '# 🗑️ DEAD CODE REPORT - DIRECTORY\n\n';
    report += `**Directory:** \`${dir}\`\n`;
    report += `**Generated:** ${new Date().toLocaleString()}\n\n`;

    const totalIssues = results.reduce((sum, r) => sum + r.issues.length, 0);
    report += `## 📊 Summary\n\n`;
    report += `- **Files analyzed:** ${results.length}\n`;
    report += `- **Total issues:** ${totalIssues}\n\n`;

    if (totalIssues === 0) {
      report += '✅ **No dead code found!**\n\n';
      return report;
    }

    // Группировка по файлам
    for (const result of results) {
      if (result.issues.length === 0) continue;

      report += `## 📄 ${path.basename(result.file)}\n\n`;

      // Функции
      if (result.functions.unused.length > 0) {
        report += '### Unused Functions\n\n';
        for (const func of result.functions.unused) {
          report += `- \`${func.name}\` (line ${func.line})\n`;
        }
        report += '\n';
      }

      // Переменные
      if (result.variables.unused.length > 0) {
        report += '### Unused Variables\n\n';
        for (const variable of result.variables.unused) {
          report += `- \`${variable.name}\` (line ${variable.line})\n`;
        }
        report += '\n';
      }

      // Импорты
      if (result.imports.unused.length > 0) {
        report += '### Unused Imports\n\n';
        for (const imp of result.imports.unused) {
          report += `- \`${imp.name}\` from \`${imp.source}\` (line ${imp.line})\n`;
        }
        report += '\n';
      }

      report += '---\n\n';
    }

    return report;
  }
}

// Экспорт по умолчанию
export default DeadCodeCommand;
