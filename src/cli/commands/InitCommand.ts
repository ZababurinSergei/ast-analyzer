// packages/ast-analyzer/src/cli/commands/InitCommand.js
// НОВЫЙ ФАЙЛ - Полный текст

/**
 * Команда: init
 *
 * Создает конфигурационные файлы для проекта:
 * - .ast-cicd.json - конфигурация CI/CD пайплайна
 * - .eslintrc.json - конфигурация ESLint (если отсутствует)
 * - tsconfig.json - конфигурация TypeScript (если отсутствует)
 *
 * Использование:
 *   npx ast-analyzer init
 *   npx ast-analyzer init --force
 *   npx ast-analyzer init --eslint-only
 *   npx ast-analyzer init --tsconfig-only
 */

import fs from 'fs';
import path from 'path';
import { Command } from 'commander';

/**
 * Опции команды init
 */
export interface InitCommandOptions {
  /** Принудительно перезаписать существующие файлы */
  force?: boolean;
  /** Только ESLint конфигурация */
  eslintOnly?: boolean;
  /** Только tsconfig.json */
  tsconfigOnly?: boolean;
  /** Только .ast-cicd.json */
  cicdOnly?: boolean;
  /** Путь к проекту (по умолчанию текущая директория) */
  projectPath?: string;
}

/**
 * Результат выполнения команды
 */
export interface InitCommandResult {
  /** Созданные файлы */
  created: string[];
  /** Обновленные файлы */
  updated: string[];
  /** Пропущенные файлы */
  skipped: string[];
  /** Ошибки */
  errors: string[];
}

/**
 * Класс команды Init
 */
export class InitCommand {
  private options: InitCommandOptions;
  private projectPath: string;
  private result: InitCommandResult;

  constructor(options: InitCommandOptions = {}) {
    this.options = {
      force: false,
      eslintOnly: false,
      tsconfigOnly: false,
      cicdOnly: false,
      projectPath: process.cwd(),
      ...options,
    };

    this.projectPath = path.resolve(this.options.projectPath || process.cwd());
    this.result = {
      created: [],
      updated: [],
      skipped: [],
      errors: [],
    };
  }

  /**
   * Запускает выполнение команды
   */
  async execute(): Promise<InitCommandResult> {
    console.log('\n📦 Initializing project configuration...');
    console.log(`📁 Project path: ${this.projectPath}\n`);

    // Проверяем существование директории
    if (!fs.existsSync(this.projectPath)) {
      console.error(`❌ Project directory not found: ${this.projectPath}`);
      this.result.errors.push(`Directory not found: ${this.projectPath}`);
      return this.result;
    }

    // Определяем, что нужно создать
    const createEslint = !this.options.tsconfigOnly && !this.options.cicdOnly;
    const createTsconfig = !this.options.eslintOnly && !this.options.cicdOnly;
    const createCicd = !this.options.eslintOnly && !this.options.tsconfigOnly;

    // 1. Создаем .ast-cicd.json
    if (createCicd) {
      await this.createCicdConfig();
    }

    // 2. Создаем .eslintrc.json
    if (createEslint) {
      await this.createEslintConfig();
    }

    // 3. Создаем tsconfig.json
    if (createTsconfig) {
      await this.createTsConfig();
    }

    // 4. Создаем .prettierrc.json (опционально)
    await this.createPrettierConfig();

    // 5. Создаем .gitignore если нет
    await this.createGitIgnore();

    // Выводим результаты
    this.printResult();

    return this.result;
  }

  /**
   * Создает конфигурацию .ast-cicd.json
   */
  private async createCicdConfig(): Promise<void> {
    const configPath = path.join(this.projectPath, '.ast-cicd.json');

    if (fs.existsSync(configPath) && !this.options.force) {
      console.log(`⚠️  .ast-cicd.json already exists (use --force to overwrite)`);
      this.result.skipped.push('.ast-cicd.json');
      return;
    }

    const config = {
      $schema: './node_modules/ast-analyzer/ci-cd-schema.json',
      version: '1.0.0',

      // TypeScript настройки
      typescript: {
        strict: true,
        noImplicitAny: true,
        strictNullChecks: true,
        strictFunctionTypes: true,
        strictBindCallApply: true,
        strictPropertyInitialization: true,
        noImplicitThis: true,
        alwaysStrict: true,
        jsx: true,
        target: 'ES2020',
        module: 'ESNext',
      },

      // JSX/TSX анализ
      jsxAnalysis: {
        enabled: true,
        checkPropTypes: true,
        detectUnusedComponents: true,
        detectMissingImports: true,
      },

      // Vue анализ
      vueAnalysis: {
        enabled: true,
        checkProps: true,
        checkEmits: true,
        checkSlots: true,
        detectUnusedComposables: true,
      },

      // ESLint настройки
      eslint: {
        enabled: true,
        config: '.eslintrc.json',
        autoFix: true,
        rules: {
          'react/jsx-uses-react': 'off',
          'react/react-in-jsx-scope': 'off',
          '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
          '@typescript-eslint/no-explicit-any': 'warn',
        },
      },

      // Автоисправление
      autoFix: {
        enabled: true,
        createBackup: true,
        maxIterations: 3,
        fixUnusedImports: true,
        fixUnusedVariables: true,
        addMissingTypes: true,
        optimizeImports: true,
      },

      // Игнорирование
      ignore: {
        files: [
          '**/*.test.ts',
          '**/*.spec.ts',
          '**/*.test.js',
          '**/*.spec.js',
          '**/dist/**',
          '**/build/**',
          '**/coverage/**',
          '**/node_modules/**',
        ],
        errors: [2307, 2304, 6133],
      },

      // CI/CD пайплайн
      pipeline: {
        runOnSave: false,
        preCommit: true,
        generateReport: true,
        reportFormat: 'html',
        outputDir: './cicd-reports',
        failOnWarnings: false,
        maxErrors: 0,
        maxWarnings: 10,
      },

      // Семантический анализ
      semanticAnalysis: {
        enabled: true,
        formalVerification: false,
        maxDepth: 5,
        checkNullPointers: true,
        checkCyclicDependencies: true,
        checkUnreachableCode: true,
      },

      // Рефакторинг
      refactoring: {
        enabled: true,
        targetClusterSize: 3,
        maxClusterSize: 10,
        minCohesionScore: 60,
        createBackup: true,
        guaranteeMode: true,
        maxAttempts: 3,
        verifyEquivalence: true,
      },

      // Отчеты
      reporting: {
        format: 'compact',
        includeBody: false,
        includeVSCodeLinks: true,
        includeStats: true,
        ultraCompact: false,
        useBitFlags: true,
        useDictionaries: true,
      },
    };

    try {
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      console.log(`✅ Created: .ast-cicd.json`);
      this.result.created.push('.ast-cicd.json');
    } catch (error) {
      console.error(`❌ Failed to create .ast-cicd.json:`, error);
      this.result.errors.push(`Failed to create .ast-cicd.json: ${error}`);
    }
  }

  /**
   * Создает конфигурацию ESLint
   */
  private async createEslintConfig(): Promise<void> {
    const configPath = path.join(this.projectPath, '.eslintrc.json');

    if (fs.existsSync(configPath) && !this.options.force) {
      console.log(`⚠️  .eslintrc.json already exists (use --force to overwrite)`);
      this.result.skipped.push('.eslintrc.json');
      return;
    }

    // Определяем, есть ли в проекте React
    const hasReact = this.detectReact();

    const config = {
      extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        hasReact ? 'plugin:react/recommended' : null,
        hasReact ? 'plugin:react-hooks/recommended' : null,
      ].filter(Boolean),

      parser: '@typescript-eslint/parser',

      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: hasReact,
        },
      },

      env: {
        browser: true,
        node: true,
        es2022: true,
      },

      settings: hasReact
        ? {
            react: {
              version: 'detect',
            },
          }
        : undefined,

      rules: {
        // TypeScript правила
        '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
        '@typescript-eslint/no-explicit-any': 'warn',
        '@typescript-eslint/no-empty-function': 'warn',
        '@typescript-eslint/ban-ts-comment': 'warn',
        '@typescript-eslint/no-non-null-assertion': 'warn',
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/explicit-module-boundary-types': 'off',

        // React правила
        ...(hasReact
          ? {
              'react/jsx-uses-react': 'off',
              'react/react-in-jsx-scope': 'off',
              'react/jsx-boolean-value': 'warn',
              'react/self-closing-comp': 'warn',
              'react/jsx-pascal-case': 'warn',
              'react/jsx-curly-brace-presence': ['warn', { props: 'never', children: 'never' }],
              'react/jsx-tag-spacing': ['warn', { beforeSelfClosing: 'always' }],
              'react/jsx-wrap-multilines': [
                'warn',
                {
                  declaration: 'parens-new-line',
                  assignment: 'parens-new-line',
                  return: 'parens-new-line',
                  arrow: 'parens-new-line',
                  condition: 'parens-new-line',
                  logical: 'parens-new-line',
                  prop: 'ignore',
                },
              ],
              'react-hooks/rules-of-hooks': 'error',
              'react-hooks/exhaustive-deps': 'warn',
            }
          : {}),

        // Общие правила
        'no-console': ['warn', { allow: ['warn', 'error'] }],
        eqeqeq: ['error', 'always'],
        'prefer-const': 'warn',
        'no-var': 'error',
        'prefer-arrow-callback': 'warn',
        'object-shorthand': ['warn', 'always'],
        'arrow-body-style': ['warn', 'as-needed'],
        'no-unused-expressions': 'warn',
        'no-return-await': 'warn',
        'require-await': 'warn',
      },
    };

    try {
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      console.log(`✅ Created: .eslintrc.json`);
      this.result.created.push('.eslintrc.json');
    } catch (error) {
      console.error(`❌ Failed to create .eslintrc.json:`, error);
      this.result.errors.push(`Failed to create .eslintrc.json: ${error}`);
    }
  }

  /**
   * Создает конфигурацию TypeScript
   */
  private async createTsConfig(): Promise<void> {
    const configPath = path.join(this.projectPath, 'tsconfig.json');

    if (fs.existsSync(configPath) && !this.options.force) {
      console.log(`⚠️  tsconfig.json already exists (use --force to overwrite)`);
      this.result.skipped.push('tsconfig.json');
      return;
    }

    // Определяем, есть ли в проекте React
    const hasReact = this.detectReact();
    const hasVue = this.detectVue();

    const config = {
      compilerOptions: {
        // Версии
        target: 'ES2020',
        module: 'ESNext',
        moduleResolution: 'node',
        lib: ['ES2020', 'DOM', 'DOM.Iterable'],

        // JavaScript
        allowJs: true,
        checkJs: true,

        // JSX
        jsx: hasReact ? 'react-jsx' : 'preserve',

        // Строгость
        strict: true,
        noImplicitAny: true,
        strictNullChecks: true,
        strictFunctionTypes: true,
        strictBindCallApply: true,
        strictPropertyInitialization: true,
        noImplicitThis: true,
        alwaysStrict: true,

        // Дополнительные проверки
        noUnusedLocals: true,
        noUnusedParameters: true,
        noImplicitReturns: true,
        noFallthroughCasesInSwitch: true,
        noUncheckedIndexedAccess: true,

        // Модули
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        resolveJsonModule: true,
        isolatedModules: true,

        // Вывод
        noEmit: true,
        declaration: false,

        // Другое
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        types: ['node'],

        // Пути (алиасы) - если есть конфиг
        ...(fs.existsSync(path.join(this.projectPath, 'src'))
          ? {
              baseUrl: '.',
              paths: {
                '@/*': ['src/*'],
                '#/*': ['src/*'],
                '~/*': ['src/*'],
              },
            }
          : {}),
      },

      include: [
        '**/*.ts',
        '**/*.tsx',
        '**/*.js',
        '**/*.jsx',
        '**/*.mjs',
        '**/*.cjs',
        ...(hasVue ? ['**/*.vue'] : []),
      ],

      exclude: [
        'node_modules',
        'dist',
        'build',
        'coverage',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/*.test.js',
        '**/*.spec.js',
      ],
    };

    try {
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      console.log(`✅ Created: tsconfig.json`);
      this.result.created.push('tsconfig.json');
    } catch (error) {
      console.error(`❌ Failed to create tsconfig.json:`, error);
      this.result.errors.push(`Failed to create tsconfig.json: ${error}`);
    }
  }

  /**
   * Создает конфигурацию Prettier (опционально)
   */
  private async createPrettierConfig(): Promise<void> {
    const configPath = path.join(this.projectPath, '.prettierrc.json');

    // Не перезаписываем существующий
    if (fs.existsSync(configPath)) {
      return;
    }

    const config = {
      semi: true,
      singleQuote: true,
      trailingComma: 'es5',
      tabWidth: 2,
      useTabs: false,
      printWidth: 100,
      bracketSpacing: true,
      arrowParens: 'avoid',
      endOfLine: 'lf',
    };

    try {
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      console.log(`✅ Created: .prettierrc.json`);
      this.result.created.push('.prettierrc.json');
    } catch (error) {
      // Игнорируем ошибку, Prettier не обязателен
    }
  }

  /**
   * Создает .gitignore если отсутствует
   */
  private async createGitIgnore(): Promise<void> {
    const ignorePath = path.join(this.projectPath, '.gitignore');

    // Не перезаписываем существующий
    if (fs.existsSync(ignorePath)) {
      return;
    }

    const content = `# Dependencies
node_modules/
.pnpm-store/
yarn-error.log
package-lock.json
pnpm-lock.yaml

# Build outputs
dist/
build/
coverage/
.nyc_output/
out/
.next/
.nuxt/
.output/
.vercel/

# IDE
.vscode/
.idea/
*.swp
*.swo
.DS_Store
Thumbs.db

# Environment
.env
.env.local
.env.*.local

# Logs
logs/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Cache
.cache/
.turbo/
.parcel-cache/
.eslintcache

# Reports
*.report.json
*.report.md
semantic-reports/
cicd-reports/
verification-reports/
hybrid-reports/

# Temporary
tmp/
temp/
*.tmp
*.temp
*.backup.*
*.checkpoint.*
*.working-copy.*

# Testing
coverage/
.nyc_output/
*.test.ts
*.test.js
*.spec.ts
*.spec.js

# Misc
*.d.ts.map
*.js.map
*.ts.map
`;

    try {
      fs.writeFileSync(ignorePath, content);
      console.log(`✅ Created: .gitignore`);
      this.result.created.push('.gitignore');
    } catch (error) {
      // Игнорируем ошибку
    }
  }

  /**
   * Проверяет, есть ли в проекте React
   */
  private detectReact(): boolean {
    try {
      const packageJson = this.readPackageJson();
      const deps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };
      return !!(deps.react || deps['react-dom']);
    } catch {
      return false;
    }
  }

  /**
   * Проверяет, есть ли в проекте Vue
   */
  private detectVue(): boolean {
    try {
      const packageJson = this.readPackageJson();
      const deps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };
      return !!(deps.vue || deps['@vue/cli-service']);
    } catch {
      return false;
    }
  }

  /**
   * Читает package.json
   */
  private readPackageJson(): any {
    const packagePath = path.join(this.projectPath, 'package.json');
    if (!fs.existsSync(packagePath)) {
      return {};
    }
    return JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
  }

  /**
   * Выводит результаты выполнения
   */
  private printResult(): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 INIT RESULTS');
    console.log('='.repeat(60));

    if (this.result.created.length > 0) {
      console.log('\n✅ Created files:');
      for (const file of this.result.created) {
        console.log(`   📄 ${file}`);
      }
    }

    if (this.result.updated.length > 0) {
      console.log('\n🔄 Updated files:');
      for (const file of this.result.updated) {
        console.log(`   📄 ${file}`);
      }
    }

    if (this.result.skipped.length > 0) {
      console.log('\n⏭️  Skipped files (already exist):');
      for (const file of this.result.skipped) {
        console.log(`   📄 ${file}`);
      }
      console.log('   💡 Use --force to overwrite');
    }

    if (this.result.errors.length > 0) {
      console.log('\n❌ Errors:');
      for (const error of this.result.errors) {
        console.log(`   ${error}`);
      }
    }

    console.log('\n💡 Next steps:');
    console.log('   • Run: npm install');
    console.log('   • Run: npx ast-analyzer status');
    console.log('   • Run: npx ast-analyzer project . --entities');
    console.log('   • Run: npx ast-analyzer compact . --ultra');

    if (this.detectReact()) {
      console.log('\n⚛️  React detected!');
      console.log('   • Run: npx ast-analyzer vue-analyze ./src/App.tsx');
    }

    if (this.detectVue()) {
      console.log('\n🎯 Vue detected!');
      console.log('   • Run: npx ast-analyzer vue-analyze ./src/App.vue');
    }

    console.log('\n' + '='.repeat(60));
  }
}

/**
 * Создает команду init для Commander
 */
export function createInitCommand(): Command {
  const command = new Command('init')
    .description('Initialize project configuration files')
    .option('--force', 'Force overwrite existing files')
    .option('--eslint-only', 'Create only ESLint configuration')
    .option('--tsconfig-only', 'Create only tsconfig.json')
    .option('--cicd-only', 'Create only .ast-cicd.json')
    .option('-p, --project-path <path>', 'Project path', process.cwd())
    .action(async options => {
      const cmd = new InitCommand({
        force: options.force,
        eslintOnly: options.eslintOnly,
        tsconfigOnly: options.tsconfigOnly,
        cicdOnly: options.cicdOnly,
        projectPath: options.projectPath,
      });
      await cmd.execute();
    });

  return command;
}

// Экспорт по умолчанию
export default InitCommand;
