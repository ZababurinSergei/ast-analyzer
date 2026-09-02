// packages/ast-analyzer/src/cli/commands/StatusCommand.ts
// НОВЫЙ ФАЙЛ - Полный текст

import { glob } from 'glob';
import path from 'path';
import fs from 'fs';
import type { Command } from 'commander';

/**
 * Команда для отображения статуса проекта
 *
 * Показывает:
 * - Количество файлов по типам (TS, JS, Vue, JSX/TSX)
 * - Наличие конфигурационных файлов (tsconfig, eslint, prettier)
 * - Статистику TypeScript ошибок (если есть валидатор)
 * - Рекомендации по улучшению
 *
 * Использование:
 *   npx ast-analyzer status
 *   npx ast-analyzer status --path ./src
 *   npx ast-analyzer status --verbose
 */
export class StatusCommand {
  private program: Command;

  constructor(program: Command) {
    this.program = program;
    this.register();
  }

  private register(): void {
    this.program
      .command('status')
      .description('Show project status overview with statistics and recommendations')
      .option('-p, --path <dir>', 'Project path to analyze', '.')
      .option('-v, --verbose', 'Show detailed information')
      .option('--json', 'Output in JSON format')
      .option('--no-check', 'Skip TypeScript type checking')
      .action(async options => {
        try {
          await this.execute(options);
        } catch (error) {
          console.error('❌ Status command failed:', error);
          process.exit(1);
        }
      });
  }

  private async execute(options: {
    path: string;
    verbose: boolean;
    json: boolean;
    check: boolean;
  }): Promise<void> {
    const projectPath = path.resolve(options.path);

    if (!fs.existsSync(projectPath)) {
      console.error(`❌ Project path not found: ${projectPath}`);
      process.exit(1);
    }

    const isVerbose = options.verbose || false;
    const isJson = options.json || false;

    // Собираем информацию
    const info = await this.collectProjectInfo(projectPath, options.check !== false);

    if (isJson) {
      console.log(JSON.stringify(info, null, 2));
      return;
    }

    // Выводим красивый отчет
    this.printReport(info, projectPath, isVerbose);
  }

  private async collectProjectInfo(projectPath: string, checkTypes: boolean): Promise<ProjectInfo> {
    const info: ProjectInfo = {
      projectPath,
      files: {
        typescript: [],
        javascript: [],
        vue: [],
        jsx: [],
        tsx: [],
        total: 0,
      },
      configs: {
        tsconfig: false,
        eslint: false,
        prettier: false,
        packageJson: false,
      },
      stats: {
        totalLines: 0,
        totalSize: 0,
        errors: 0,
        warnings: 0,
      },
      dependencies: {
        total: 0,
        dev: 0,
        peer: 0,
        outdated: 0,
      },
      recommendations: [],
      timestamp: new Date().toISOString(),
    };

    // 1. Собираем файлы
    await this.collectFiles(projectPath, info);

    // 2. Проверяем конфигурации
    this.checkConfigs(projectPath, info);

    // 3. Собираем статистику по файлам
    await this.collectFileStats(projectPath, info);

    // 4. Проверяем зависимости
    await this.checkDependencies(projectPath, info);

    // 5. Проверяем типы (опционально)
    if (checkTypes) {
      await this.checkTypes(projectPath, info);
    }

    // 6. Формируем рекомендации
    this.generateRecommendations(info);

    return info;
  }

  private async collectFiles(projectPath: string, info: ProjectInfo): Promise<void> {
    const patterns = [
      {
        pattern: '**/*.ts',
        ignore: ['**/*.d.ts', '**/*.test.ts', '**/*.spec.ts'],
        type: 'typescript' as const,
      },
      { pattern: '**/*.tsx', ignore: ['**/*.test.tsx', '**/*.spec.tsx'], type: 'tsx' as const },
      { pattern: '**/*.js', ignore: ['**/*.test.js', '**/*.spec.js'], type: 'javascript' as const },
      { pattern: '**/*.jsx', ignore: ['**/*.test.jsx', '**/*.spec.jsx'], type: 'jsx' as const },
      { pattern: '**/*.vue', ignore: [], type: 'vue' as const },
    ];

    for (const { pattern, ignore, type } of patterns) {
      try {
        const files = await glob(pattern, {
          cwd: projectPath,
          ignore: [
            '**/node_modules/**',
            '**/dist/**',
            '**/build/**',
            '**/coverage/**',
            '**/.next/**',
            '**/.nuxt/**',
            '**/.output/**',
            ...ignore,
          ],
          absolute: true,
        });

        const fileList = files.map(f => path.relative(projectPath, f));

        switch (type) {
          case 'typescript':
            info.files.typescript = fileList;
            break;
          case 'javascript':
            info.files.javascript = fileList;
            break;
          case 'vue':
            info.files.vue = fileList;
            break;
          case 'jsx':
            info.files.jsx = fileList;
            break;
          case 'tsx':
            info.files.tsx = fileList;
            break;
        }
        info.files.total += fileList.length;
      } catch (error) {
        console.warn(`⚠️ Error collecting ${type} files:`, error);
      }
    }
  }

  private checkConfigs(projectPath: string, info: ProjectInfo): void {
    const configs: Record<string, string> = {
      tsconfig: 'tsconfig.json',
      eslint: '.eslintrc.json',
      prettier: '.prettierrc.json',
      packageJson: 'package.json',
    };

    for (const [key, fileName] of Object.entries(configs)) {
      const configPath = path.join(projectPath, fileName);
      const configKey = key as keyof ProjectInfo['configs'];
      info.configs[configKey] = fs.existsSync(configPath);
    }
  }

  private async collectFileStats(projectPath: string, info: ProjectInfo): Promise<void> {
    let totalLines = 0;
    let totalSize = 0;

    const allFiles = [
      ...info.files.typescript,
      ...info.files.javascript,
      ...info.files.vue,
      ...info.files.jsx,
      ...info.files.tsx,
    ];

    for (const file of allFiles) {
      try {
        const fullPath = path.join(projectPath, file);
        const stat = fs.statSync(fullPath);
        totalSize += stat.size;

        if (stat.size < 1024 * 1024) {
          // Пропускаем большие файлы для производительности
          const content = fs.readFileSync(fullPath, 'utf-8');
          totalLines += content.split('\n').length;
        }
      } catch (error) {
        // Игнорируем ошибки
      }
    }

    info.stats.totalLines = totalLines;
    info.stats.totalSize = totalSize;
  }

  private async checkDependencies(projectPath: string, info: ProjectInfo): Promise<void> {
    const packagePath = path.join(projectPath, 'package.json');
    if (!fs.existsSync(packagePath)) return;

    try {
      const content = fs.readFileSync(packagePath, 'utf-8');
      const pkg = JSON.parse(content);

      const deps = pkg.dependencies || {};
      const devDeps = pkg.devDependencies || {};
      const peerDeps = pkg.peerDependencies || {};

      info.dependencies.total = Object.keys(deps).length + Object.keys(devDeps).length;
      info.dependencies.dev = Object.keys(devDeps).length;
      info.dependencies.peer = Object.keys(peerDeps).length;

      // Проверяем устаревшие зависимости (только в verbose режиме)
      // Это требует network, поэтому делаем опционально
      if (process.env.CHECK_OUTDATED === 'true') {
        // Здесь можно добавить проверку устаревших пакетов
        // Для простоты пропускаем
      }
    } catch (error) {
      // Игнорируем ошибки парсинга package.json
    }
  }

  private async checkTypes(projectPath: string, info: ProjectInfo): Promise<void> {
    // Проверяем, есть ли TypeScript файлы
    if (info.files.typescript.length === 0 && info.files.tsx.length === 0) {
      return;
    }

    // Проверяем наличие tsconfig
    if (!info.configs.tsconfig) {
      info.recommendations.push({
        type: 'warning',
        message: 'TypeScript files found but no tsconfig.json',
        suggestion: 'Run: npx ast-analyzer init to create tsconfig.json',
      });
      return;
    }

    try {
      // Используем TypeScript Validator если доступен
      const { TypeScriptValidator } = await import('../../refactor/TypeScriptValidator.js');
      const validator = new TypeScriptValidator(
        path.join(projectPath, 'tsconfig.json'),
        true // dry run
      );

      const allFiles = [
        ...info.files.typescript.map(f => path.join(projectPath, f)),
        ...info.files.tsx.map(f => path.join(projectPath, f)),
      ];

      if (allFiles.length > 0) {
        const result = await validator.validateAndFix(allFiles, 0);
        info.stats.errors = result.remainingErrors;
        info.stats.warnings = result.diagnostics.filter(d => d.severity === 'warning').length;

        if (result.remainingErrors > 0) {
          info.recommendations.push({
            type: 'error',
            message: `${result.remainingErrors} TypeScript errors found`,
            suggestion: 'Run: npx ast-analyzer ts-fix . -r or fix manually',
          });
        }
      }
    } catch (error) {
      // Игнорируем ошибки валидатора
      if (info.stats.errors === undefined) {
        info.stats.errors = 0;
      }
    }
  }

  private generateRecommendations(info: ProjectInfo): void {
    // Проверяем наличие конфигураций
    if (!info.configs.tsconfig && (info.files.typescript.length > 0 || info.files.tsx.length > 0)) {
      info.recommendations.push({
        type: 'warning',
        message: 'No tsconfig.json found for TypeScript files',
        suggestion: 'Run: npx ast-analyzer init',
      });
    }

    if (!info.configs.eslint) {
      info.recommendations.push({
        type: 'info',
        message: 'ESLint configuration not found',
        suggestion: 'Run: npx ast-analyzer eslint-init',
      });
    }

    if (!info.configs.prettier) {
      info.recommendations.push({
        type: 'info',
        message: 'Prettier configuration not found (optional)',
        suggestion: 'Create .prettierrc.json for consistent formatting',
      });
    }

    // Проверяем размер проекта
    if (info.files.total > 100) {
      info.recommendations.push({
        type: 'info',
        message: `Large project: ${info.files.total} files`,
        suggestion: 'Consider using: npx ast-analyzer project . --entities --optimized',
      });
    }

    if (info.stats.totalSize > 10 * 1024 * 1024) {
      info.recommendations.push({
        type: 'info',
        message: `Large codebase: ${(info.stats.totalSize / 1024 / 1024).toFixed(1)} MB`,
        suggestion: 'Use: npx ast-analyzer minify-folder . -o project-context.md',
      });
    }

    // Проверяем наличие Vue файлов
    if (info.files.vue.length > 0) {
      const vueCount = info.files.vue.length;
      info.recommendations.push({
        type: 'info',
        message: `${vueCount} Vue components found`,
        suggestion: `Analyze: npx ast-analyzer vue-analyze ./src/App.vue`,
      });
    }

    // Проверяем наличие JSX/TSX
    const jsxCount = info.files.jsx.length + info.files.tsx.length;
    if (jsxCount > 0) {
      info.recommendations.push({
        type: 'info',
        message: `${jsxCount} JSX/TSX files found`,
        suggestion: 'Consider: npx ast-analyzer compact ./src --ultra',
      });
    }

    // Проверяем наличие ошибок
    if (info.stats.errors && info.stats.errors > 0) {
      info.recommendations.push({
        type: 'error',
        message: `${info.stats.errors} TypeScript errors found`,
        suggestion: 'Run: npx ast-analyzer ts-fix . -r',
      });
    }

    if (
      info.dependencies.total === 0 &&
      fs.existsSync(path.join(info.projectPath, 'package.json'))
    ) {
      info.recommendations.push({
        type: 'warning',
        message: 'No dependencies found in package.json',
        suggestion: 'Check your package.json configuration',
      });
    }
  }

  private printReport(info: ProjectInfo, projectPath: string, verbose: boolean): void {
    console.log('\n' + '='.repeat(70));
    console.log(`📊 PROJECT STATUS REPORT`);
    console.log('='.repeat(70));
    console.log(`📁 Project: ${projectPath}`);
    console.log(`📅 Generated: ${new Date(info.timestamp).toLocaleString()}`);
    console.log('='.repeat(70));

    // Файлы
    console.log('\n📄 FILES:');
    console.log(`   • TypeScript (.ts): ${info.files.typescript.length}`);
    console.log(`   • TSX (.tsx): ${info.files.tsx.length}`);
    console.log(`   • JavaScript (.js): ${info.files.javascript.length}`);
    console.log(`   • JSX (.jsx): ${info.files.jsx.length}`);
    console.log(`   • Vue (.vue): ${info.files.vue.length}`);
    console.log(`   • Total files: ${info.files.total}`);

    if (verbose) {
      console.log('\n   📂 TypeScript files:');
      for (const file of info.files.typescript.slice(0, 10)) {
        console.log(`      - ${file}`);
      }
      if (info.files.typescript.length > 10) {
        console.log(`      ... and ${info.files.typescript.length - 10} more`);
      }

      if (info.files.vue.length > 0) {
        console.log('\n   📂 Vue files:');
        for (const file of info.files.vue.slice(0, 5)) {
          console.log(`      - ${file}`);
        }
        if (info.files.vue.length > 5) {
          console.log(`      ... and ${info.files.vue.length - 5} more`);
        }
      }
    }

    // Статистика
    console.log('\n📊 STATISTICS:');
    console.log(`   • Total lines: ${info.stats.totalLines.toLocaleString()}`);
    console.log(`   • Total size: ${(info.stats.totalSize / 1024 / 1024).toFixed(2)} MB`);
    if (info.stats.errors !== undefined) {
      console.log(`   • TypeScript errors: ${info.stats.errors}`);
    }
    if (info.stats.warnings !== undefined) {
      console.log(`   • TypeScript warnings: ${info.stats.warnings}`);
    }

    // Конфигурации
    console.log('\n⚙️ CONFIGURATIONS:');
    console.log(`   • tsconfig.json: ${info.configs.tsconfig ? '✅' : '❌'}`);
    console.log(`   • .eslintrc.json: ${info.configs.eslint ? '✅' : '❌'}`);
    console.log(`   • .prettierrc.json: ${info.configs.prettier ? '✅' : '❌'}`);
    console.log(`   • package.json: ${info.configs.packageJson ? '✅' : '❌'}`);

    // Зависимости
    if (info.dependencies.total > 0) {
      console.log('\n📦 DEPENDENCIES:');
      console.log(`   • Total: ${info.dependencies.total}`);
      console.log(`   • Dev: ${info.dependencies.dev}`);
      console.log(`   • Peer: ${info.dependencies.peer}`);
    }

    // Рекомендации
    if (info.recommendations.length > 0) {
      console.log('\n💡 RECOMMENDATIONS:');
      for (const rec of info.recommendations) {
        const icon = rec.type === 'error' ? '❌' : rec.type === 'warning' ? '⚠️' : 'ℹ️';
        console.log(`   ${icon} ${rec.message}`);
        if (rec.suggestion) {
          console.log(`      → ${rec.suggestion}`);
        }
      }
    }

    // Быстрые команды
    console.log('\n🚀 QUICK COMMANDS:');
    console.log('   • Full analysis:    npx ast-analyzer project . --entities');
    console.log('   • Compact report:   npx ast-analyzer compact . --ultra');
    console.log('   • Minify project:   npx ast-analyzer minify-folder .');
    console.log('   • Split modules:    npx ast-analyzer split-module ./src/index.ts');
    console.log('   • Vue analyze:      npx ast-analyzer vue-analyze ./src/App.vue');
    console.log('   • Semantic check:   npx ast-analyzer semantic . -r');

    if (info.files.vue.length > 0) {
      console.log('   • Vue analysis:     npx ast-analyzer vue-analyze ./src/App.vue');
    }

    if (info.files.typescript.length > 0 && info.stats.errors && info.stats.errors > 0) {
      console.log('   • Fix TypeScript:   npx ast-analyzer ts-fix . -r');
    }

    console.log('\n' + '='.repeat(70) + '\n');
  }
}

// ============================================
// ТИПЫ
// ============================================

export interface ProjectInfo {
  projectPath: string;
  files: {
    typescript: string[];
    javascript: string[];
    vue: string[];
    jsx: string[];
    tsx: string[];
    total: number;
  };
  configs: {
    tsconfig: boolean;
    eslint: boolean;
    prettier: boolean;
    packageJson: boolean;
  };
  stats: {
    totalLines: number;
    totalSize: number;
    errors?: number;
    warnings?: number;
  };
  dependencies: {
    total: number;
    dev: number;
    peer: number;
    outdated: number;
  };
  recommendations: {
    type: 'error' | 'warning' | 'info';
    message: string;
    suggestion?: string;
  }[];
  timestamp: string;
}

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ
// ============================================

export default StatusCommand;
