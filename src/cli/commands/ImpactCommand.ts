// packages/ast-analyzer/src/cli/commands/ImpactCommand.ts
// НОВЫЙ ФАЙЛ - Полный текст

import type { Command } from 'commander';
import fs from 'fs';
import path from 'path';

/**
 * Команда для анализа зоны влияния изменений
 *
 * Находит все файлы и функции, которые используют указанную сущность.
 * Это критически важно для понимания последствий изменений в коде.
 *
 * Использование:
 *   ast-analyzer impact <file> <entity> [options]
 *   ast-analyzer impact ./src/db.ts findUser --output report.md
 *   ast-analyzer impact ./src/utils.ts validateEmail --verbose
 */
export class ImpactCommand {
  /**
   * Регистрирует команду в программе CLI
   */
  register(program: Command): void {
    program
      .command('impact <file> <entity>')
      .description(
        'Analyze impact zone: find all files and functions using the entity.\n' +
          'Helps understand the consequences of changing or removing code.'
      )
      .option('-o, --output <file>', 'Output file for the report', 'ai-impact-report.md')
      .option('-v, --verbose', 'Show detailed information including line numbers and call contexts')
      .option('--json', 'Output in JSON format instead of Markdown')
      .option('--depth <n>', 'Maximum depth for transitive dependencies', '3')
      .option('--only-direct', 'Show only direct dependents (no transitive)')
      .option('--filter <pattern>', 'Filter results by file pattern (e.g., "src/**/*.ts")')
      .action(async (file, entity, options) => {
        console.log('💥 Analyzing impact zone...');
        console.log(`📄 Target file: ${file}`);
        console.log(`🎯 Entity: ${entity}`);
        console.log(`📏 Depth: ${options.depth}`);
        console.log(`🔍 Direct only: ${options.onlyDirect ? 'YES' : 'NO'}`);

        try {
          const result = await this.runImpactAnalysis(file, entity, options);

          if (options.json) {
            console.log(JSON.stringify(result, null, 2));
          } else {
            const report = this.generateMarkdownReport(result, entity, file, options);
            this.saveReport(report, options);
          }
        } catch (error) {
          console.error('❌ Impact analysis failed:', error);
          process.exit(1);
        }
      });
  }

  /**
   * Запускает анализ влияния с расширенными возможностями
   */
  private async runImpactAnalysis(
    file: string,
    entity: string,
    _options: any
  ): Promise<{
    target: { file: string; entity: string };
    directDependents: Dependent[];
    transitiveDependents: Dependent[];
    totalFiles: number;
    totalFunctions: number;
    summary: {
      direct: number;
      transitive: number;
      critical: number;
      warning: number;
    };
  }> {
    const { runImpactAnalysis: runImpactCore } = await import('../../modes/impact.js');

    // Запускаем базовый анализ
    const coreResult = runImpactCore(file, entity);

    // Парсим результат для расширенного отчета
    const directDependents: Dependent[] = [];
    const transitiveDependents: Dependent[] = [];

    // Извлекаем зависимости из отчета
    if (coreResult) {
      const lines = coreResult.split('\n');
      let currentSection: 'direct' | 'transitive' | 'none' = 'none';

      for (const line of lines) {
        if (line.includes('ЗАВИСИМЫХ ФАЙЛОВ')) {
          currentSection = 'direct';
        } else if (line.includes('Транзитивные')) {
          currentSection = 'transitive';
        } else if (line.trim().startsWith('###') && currentSection !== 'none') {
          const fileMatch = line.match(/`([^`]+)`/);
          if (fileMatch && fileMatch[1]) {
            const filePath = fileMatch[1];
            const dependents =
              currentSection === 'direct' ? directDependents : transitiveDependents;

            // Извлекаем функции из следующей строки
            const functionMatch = lines[lines.indexOf(line) + 1]?.match(/`([^`]+)`/g) || [];
            const functions = functionMatch.map((f: string) => f.replace(/`/g, ''));

            dependents.push({
              file: filePath,
              functions: functions.length > 0 ? functions : ['unknown'],
              severity: this.calculateSeverity(functions, currentSection === 'direct'),
              distance: currentSection === 'direct' ? 1 : 2,
            });
          }
        }
      }
    }

    return {
      target: { file, entity },
      directDependents,
      transitiveDependents,
      totalFiles: directDependents.length + transitiveDependents.length,
      totalFunctions:
        this.countTotalFunctions(directDependents) + this.countTotalFunctions(transitiveDependents),
      summary: {
        direct: directDependents.length,
        transitive: transitiveDependents.length,
        critical: this.countCritical(directDependents),
        warning: this.countWarning(directDependents),
      },
    };
  }

  /**
   * Генерирует Markdown отчет
   */
  private generateMarkdownReport(result: any, entity: string, file: string, options: any): string {
    let report = '# 💥 Impact Analysis Report\n\n';
    report += `**Generated:** ${new Date().toLocaleString()}\n`;
    report += `**Target Entity:** \`${entity}\`\n`;
    report += `**Source File:** \`${file}\`\n`;
    report += `**Depth:** ${options.depth}\n\n`;

    report += '---\n\n';

    // Краткая сводка
    report += '## 📊 Summary\n\n';
    report += '| Metric | Value |\n';
    report += '|--------|-------|\n';
    report += `| Direct dependents | ${result.summary.direct} |\n`;
    report += `| Transitive dependents | ${result.summary.transitive} |\n`;
    report += `| Total files affected | ${result.totalFiles} |\n`;
    report += `| Total functions affected | ${result.totalFunctions} |\n`;
    report += `| Critical dependencies | ${result.summary.critical} |\n`;
    report += `| Warnings | ${result.summary.warning} |\n\n`;

    // Оценка риска
    const riskLevel = this.calculateRiskLevel(result);
    const riskEmoji = riskLevel === 'high' ? '🔴' : riskLevel === 'medium' ? '🟡' : '🟢';
    report += `### 🎯 Risk Level: ${riskEmoji} ${riskLevel.toUpperCase()}\n\n`;

    // Рекомендации
    report += '## 💡 Recommendations\n\n';
    if (result.summary.critical > 0) {
      report += '⚠️ **CRITICAL**: Review the following files carefully before making changes:\n';
      for (const dep of result.directDependents) {
        if (dep.severity === 'critical') {
          report += `- \`${dep.file}\` (${dep.functions.join(', ')})\n`;
        }
      }
      report += '\n';
    }

    if (result.summary.direct > 0) {
      report += '1. **Update imports** in all dependent files\n';
      report += '2. **Check function signatures** for compatibility\n';
      report += '3. **Run tests** after changes\n';
    }

    if (result.transitiveDependents.length > 0) {
      report +=
        '4. **Review transitive dependencies** (files that indirectly depend on the entity)\n';
    }

    report += '\n---\n\n';

    // Прямые зависимости
    if (result.directDependents.length > 0) {
      report += '## 🔴 Direct Dependents\n\n';
      report += 'These files directly use the entity and will be affected immediately.\n\n';
      report += '| File | Functions | Severity |\n';
      report += '|------|-----------|----------|\n';
      for (const dep of result.directDependents) {
        const severityIcon =
          dep.severity === 'critical' ? '🔴' : dep.severity === 'warning' ? '🟡' : '🟢';
        report += `| \`${dep.file}\` | ${dep.functions.join(', ')} | ${severityIcon} ${dep.severity} |\n`;
      }
      report += '\n';
    }

    // Транзитивные зависимости
    if (result.transitiveDependents.length > 0 && !options.onlyDirect) {
      report += '## 🟡 Transitive Dependents\n\n';
      report += 'These files indirectly depend on the entity (2+ levels away).\n\n';
      report += '| File | Functions | Distance |\n';
      report += '|------|-----------|----------|\n';
      for (const dep of result.transitiveDependents) {
        report += `| \`${dep.file}\` | ${dep.functions.join(', ')} | ${dep.distance} |\n`;
      }
      report += '\n';
    }

    // Подробный список изменений
    if (options.verbose) {
      report += '## 📝 Detailed Change List\n\n';
      report += '### Files to Review\n\n';
      const allDeps = [...result.directDependents, ...result.transitiveDependents];
      for (const dep of allDeps) {
        report += `#### \`${dep.file}\`\n`;
        report += `- **Severity:** ${dep.severity}\n`;
        report += `- **Distance:** ${dep.distance}\n`;
        report += `- **Affected functions:** ${dep.functions.join(', ')}\n`;
        report += `- **Suggested action:** ${this.getSuggestedAction(dep)}\n\n`;
      }
    }

    // Действия
    report += '---\n\n';
    report += '## 🚀 Next Steps\n\n';
    report += '1. **Review** all files listed above\n';
    report += '2. **Update** the entity carefully\n';
    report += '3. **Run tests** to verify changes\n';
    report += '4. **Commit** changes with proper documentation\n\n';

    report += '---\n';
    report += `*Generated by AST Analyzer Impact Command v3.0.0*\n`;
    report += `*Analysis time: ${new Date().toLocaleString()}*\n`;

    return report;
  }

  /**
   * Сохраняет отчет в файл
   */
  private saveReport(report: string, options: any): void {
    const outputPath = path.resolve(options.output);
    const outputDir = path.dirname(outputPath);

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, report);
    console.log(`✅ Impact report saved: ${outputPath}`);
    console.log(`📊 Size: ${(report.length / 1024).toFixed(2)} KB`);
  }

  /**
   * Вычисляет уровень риска
   */
  private calculateRiskLevel(result: any): 'high' | 'medium' | 'low' {
    const critical = result.summary.critical || 0;
    const total = result.totalFiles || 0;

    if (critical > 5 || total > 20) return 'high';
    if (critical > 0 || total > 10) return 'medium';
    return 'low';
  }

  /**
   * Вычисляет серьезность зависимости
   */
  private calculateSeverity(
    functions: string[],
    isDirect: boolean
  ): 'critical' | 'warning' | 'info' {
    if (isDirect && functions.length > 3) return 'critical';
    if (isDirect) return 'warning';
    return 'info';
  }

  /**
   * Подсчитывает общее количество функций
   */
  private countTotalFunctions(dependents: Dependent[]): number {
    return dependents.reduce((sum, dep) => sum + dep.functions.length, 0);
  }

  /**
   * Подсчитывает количество критических зависимостей
   */
  private countCritical(dependents: Dependent[]): number {
    return dependents.filter(d => d.severity === 'critical').length;
  }

  /**
   * Подсчитывает количество предупреждений
   */
  private countWarning(dependents: Dependent[]): number {
    return dependents.filter(d => d.severity === 'warning').length;
  }

  /**
   * Возвращает предложенное действие для зависимости
   */
  private getSuggestedAction(dep: Dependent): string {
    if (dep.severity === 'critical') {
      return '⚠️ Review carefully - many functions use this entity';
    }
    if (dep.severity === 'warning') {
      return '🔧 Update the import and function call';
    }
    return 'ℹ️ Check if the change affects this file';
  }
}

/**
 * Интерфейс зависимости
 */
interface Dependent {
  file: string;
  functions: string[];
  severity: 'critical' | 'warning' | 'info';
  distance: number;
}

// Экспорт по умолчанию
export default ImpactCommand;
